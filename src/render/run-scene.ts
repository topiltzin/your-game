// 3D scene for a run. The game rules (RunSession) stay in game units; this module only draws them.
// Mapping: one game unit is UNIT scene units. Distance runs along -z, height along +y, and the
// camera sits behind the runner. The runner is always at z = 0, where obstacles reach it.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { CharacterMetrics } from "../game/character-metrics";
import { CONFIG } from "../game/config";
import type { Coin } from "../game/coins";
import type { Obstacle } from "../game/obstacles";
import type { RunSession } from "../game/run";

const COIN_COLOUR = 0xf2a51a;
/** A flat gold disc, standing so it faces the camera. */
const COIN_GEOMETRY = new THREE.CylinderGeometry(0.16, 0.16, 0.03, 20).rotateX(Math.PI / 2);

const UNIT = 0.01;
// A bright platform-game world: sky, grass track, green pipes, brick bars, dark pits.
const SKY = 0xbfe9ff;
const GRASS = 0x7bd389;
const GRASS_DARK = 0x4fae5c;
const PIPE = 0x2f9e44;
const BRICK = 0xff8a5c;
const PIT = 0x1d3b2a;
const WALL_THICKNESS = 20; // game units
const WALL_HEIGHT = 120; // game units
const BAR_HEIGHT = 14; // game units
const CAMERA_HEIGHT = 2.6;
const CAMERA_BACK = 6.4;
const LOOK_AT_HEIGHT = 0.7;
const LOOK_AT_AHEAD = -5;
const TRACK_LENGTH = 400;
const TRACK_WIDTH = 30;
const DASH_SPACING = 2;
const DASH_COUNT = 40;
const SLIDE_SCALE = CONFIG.SLIDE_HEIGHT_FACTOR;
/** Channel value above which a pixel counts as paper background (out of 255). */
const WHITE_KEY = 235;

/** The runner is a flat sprite (the player's sketch or a preset) or the 3D model from its URL. */
export type RunnerSource =
  | { readonly kind: "sprite"; readonly image: HTMLImageElement }
  | { readonly kind: "model"; readonly url: string };

/** Parsed models by URL. A model is downloaded and parsed once; every run copies it instead of re-downloading. */
const modelCache = new Map<string, Promise<THREE.Group>>();

/** Starts downloading a model in the background, so the run can begin without waiting for it. */
export function preloadModel(url: string): Promise<THREE.Group> {
  let cached = modelCache.get(url);
  if (!cached) {
    cached = new GLTFLoader().loadAsync(url).then((gltf) => gltf.scene);
    // A failed download must not stay cached, or every later run would fail too.
    cached.catch(() => modelCache.delete(url));
    modelCache.set(url, cached);
  }
  return cached;
}

export class RunScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
  private readonly runner = new THREE.Group();
  private readonly obstacleMeshes = new Map<Obstacle, THREE.Object3D>();
  private readonly dashes: THREE.Mesh[] = [];
  private readonly coinMeshes = new Map<Coin, THREE.Mesh>();
  private readonly materials = {
    pipe: new THREE.MeshBasicMaterial({ color: PIPE }),
    brick: new THREE.MeshBasicMaterial({ color: BRICK }),
    grass: new THREE.MeshBasicMaterial({ color: GRASS }),
    lane: new THREE.MeshBasicMaterial({ color: GRASS_DARK }),
    pit: new THREE.MeshBasicMaterial({ color: PIT }),
    coin: new THREE.MeshBasicMaterial({ color: COIN_COLOUR }),
  };

  constructor(canvas: HTMLCanvasElement, metrics: CharacterMetrics, source: RunnerSource) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 14, 46);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(3, 6, 4);
    this.scene.add(sun);

    this.scene.add(this.buildTrack());
    this.buildDashes();
    this.scene.add(this.runner);
    if (source.kind === "sprite") this.runner.add(buildSpriteBillboard(source.image, metrics));
    else void this.loadModel(source.url, metrics);
  }

  /** Loads the 3D model, scales it to the game's character height and stands it on the track. */
  private async loadModel(url: string, metrics: CharacterMetrics): Promise<void> {
    const model = (await preloadModel(url)).clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const scale = size.y > 0 ? (metrics.heightUnits * UNIT) / size.y : 1;
    model.scale.setScalar(scale);
    // Stand the model on the track, centred left-right and front-to-back on the runner.
    const scaled = new THREE.Box3().setFromObject(model);
    const centre = scaled.getCenter(new THREE.Vector3());
    model.position.set(-centre.x, -scaled.min.y, -centre.z);
    const holder = new THREE.Group();
    holder.add(model);
    this.runner.add(holder);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /** Places the track, runner and obstacles for the session's current state. */
  sync(session: RunSession): void {
    const runnerX = session.distance + CONFIG.RUNNER_X;
    this.runner.position.set(0, session.runnerState.y * UNIT, 0);
    this.runner.scale.y = session.runnerState.mode === "sliding" ? SLIDE_SCALE : 1;

    this.camera.position.set(0, CAMERA_HEIGHT, CAMERA_BACK);
    this.camera.lookAt(0, LOOK_AT_HEIGHT, LOOK_AT_AHEAD);

    const dashPhase = (session.distance * UNIT) % DASH_SPACING;
    this.dashes.forEach((dash, i) => {
      dash.position.z = -i * DASH_SPACING + dashPhase;
    });

    this.syncObstacles(session.upcoming(), runnerX);
    this.syncCoins(session.upcomingCoins(), runnerX, session.ticks);
  }

  /** Coins spin in place and slide toward the runner with the track. Collected coins disappear. */
  private syncCoins(visible: readonly Coin[], runnerX: number, ticks: number): void {
    const keep = new Set(visible);
    for (const [coin, mesh] of this.coinMeshes) {
      if (keep.has(coin)) continue;
      this.scene.remove(mesh);
      this.coinMeshes.delete(coin);
    }
    for (const coin of visible) {
      let mesh = this.coinMeshes.get(coin);
      if (!mesh) {
        mesh = new THREE.Mesh(COIN_GEOMETRY, this.materials.coin);
        this.coinMeshes.set(coin, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(0, coin.y * UNIT, -(coin.x - runnerX) * UNIT);
      mesh.rotation.y = ticks * 0.08;
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }

  private syncObstacles(visible: readonly Obstacle[], runnerX: number): void {
    const keep = new Set(visible);
    for (const [obstacle, mesh] of this.obstacleMeshes) {
      if (keep.has(obstacle)) continue;
      this.scene.remove(mesh);
      this.obstacleMeshes.delete(obstacle);
    }
    for (const obstacle of visible) {
      let mesh = this.obstacleMeshes.get(obstacle);
      if (!mesh) {
        mesh = this.buildObstacle(obstacle);
        this.obstacleMeshes.set(obstacle, mesh);
        this.scene.add(mesh);
      }
      // Each obstacle group is centred on its width, so its middle sits where the hitbox middle is.
      const centre = obstacle.x + obstacle.width / 2;
      mesh.position.z = -(centre - runnerX) * UNIT;
    }
  }

  private buildObstacle(obstacle: Obstacle): THREE.Object3D {
    const group = new THREE.Group();
    if (obstacle.kind === "ground_gap") {
      // A pit: a dark slab laid over the grass, so the gap reads as a hole to jump.
      // Across the track is x, along the track (distance) is z: the pit is as long as the gap, not the track.
      const hole = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH, 0.02, obstacle.width * UNIT), this.materials.pit);
      hole.position.y = 0.011;
      group.add(hole);
      return group;
    }
    if (obstacle.kind === "overhead") {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(obstacle.width * UNIT, BAR_HEIGHT * UNIT, 0.4), this.materials.brick);
      bar.position.y = (obstacle.clearance + BAR_HEIGHT / 2) * UNIT;
      group.add(bar);
      return group;
    }
    // Pinch: two walls with a passage of gapWidth between them, centred on the obstacle.
    const half = (obstacle.gapWidth / 2 + WALL_THICKNESS / 2) * UNIT;
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(WALL_THICKNESS * UNIT, WALL_HEIGHT * UNIT, 0.4), this.materials.pipe);
      wall.position.set(side * half, (WALL_HEIGHT / 2) * UNIT, 0);
      group.add(wall);
    }
    return group;
  }

  private buildTrack(): THREE.Mesh {
    const track = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH, 0.02, TRACK_LENGTH), this.materials.grass);
    track.position.set(0, -0.01, -TRACK_LENGTH / 2 + 10);
    return track;
  }

  private buildDashes(): void {
    const geometry = new THREE.BoxGeometry(0.08, 0.021, 0.8);
    for (let i = 0; i < DASH_COUNT; i++) {
      const dash = new THREE.Mesh(geometry, this.materials.lane);
      dash.position.set(0, 0.0, -i * DASH_SPACING);
      this.dashes.push(dash);
      this.scene.add(dash);
    }
  }
}

/** A sprite on a flat card, standing on the track and facing the camera. */
function buildSpriteBillboard(image: HTMLImageElement, metrics: CharacterMetrics): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(metrics.widthUnits * UNIT, metrics.heightUnits * UNIT), material);
  card.position.y = (metrics.heightUnits * UNIT) / 2;
  spriteTexture(image, (texture) => {
    material.map = texture;
    material.needsUpdate = true;
  });
  return card;
}

/** Makes a texture from a sketch or preset. Near-white pixels become transparent, so a paper background disappears. */
function spriteTexture(image: HTMLImageElement, onReady: (texture: THREE.Texture) => void): void {
  const build = () => {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx || canvas.width === 0) return;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const paper = pixels.data[i]! > WHITE_KEY && pixels.data[i + 1]! > WHITE_KEY && pixels.data[i + 2]! > WHITE_KEY;
      if (paper) pixels.data[i + 3] = 0;
    }
    ctx.putImageData(pixels, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    onReady(texture);
  };
  if (image.complete && image.naturalWidth > 0) build();
  else image.addEventListener("load", build, { once: true });
}
