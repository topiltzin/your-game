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
import { buildSpriteCanvas } from "./sprite-texture";

const UNIT = 0.01;

// World palette: the same coral, cream and ink as the interface, so the game and the menus match.
const CREAM = 0xf6f3ec;
const CORAL = 0xe2432f;
const INK = 0x1b1b1f;
const GROUND = 0x34303a;
const PIT = 0x0c0b0f;
const COIN_COLOUR = 0xf2a51a;
const HILL_NEAR = 0xe98570;
const HILL_FAR = 0xf2ae9c;
const SKY_STOPS: readonly (readonly [number, string])[] = [
  [0, "#f2735a"],
  [0.45, "#ffc9b5"],
  [0.7, "#f6f3ec"],
  [1, "#f6f3ec"],
];

/** A flat gold disc, standing so it faces the camera. */
const COIN_GEOMETRY = new THREE.CylinderGeometry(0.16, 0.16, 0.03, 20).rotateX(Math.PI / 2);

const WALL_THICKNESS = 20; // game units
const WALL_HEIGHT = 120; // game units
const BAR_HEIGHT = 14; // game units
const CAMERA_HEIGHT = 2.6;
const CAMERA_BACK = 6.4;
const LOOK_AT_HEIGHT = 0.7;
const LOOK_AT_AHEAD = -5;
const FOV_SLOW = 42;
const FOV_FAST = 52;
const TRACK_LENGTH = 400;
const TRACK_WIDTH = 30;
const DASH_SPACING = 2;
const DASH_COUNT = 40;
const POST_SPACING = 7;
const POST_COUNT = 16;
const POST_SIDE = 5.8;
const POST_HEIGHT = 2;
/** Below this width-to-height ratio (a phone held upright) the camera pulls back so the track still fits. */
const PORTRAIT_ASPECT = 0.95;
const MAX_PULL_BACK = 1.8;
const PIT_EDGE = 0.14;
const CLOUD_COUNT = 7;
const CLOUD_SPAN = 160;
const SLIDE_SCALE = CONFIG.SLIDE_HEIGHT_FACTOR;
/** Pixel-art sprites (presets) are small; they stay crisp instead of being smoothed. */
const PIXEL_ART_MAX_SIDE = 256;

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

function skyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  for (const [stop, colour] of SKY_STOPS) gradient.addColorStop(stop, colour);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class RunScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV_SLOW, 1, 0.1, 400);
  private readonly runner = new THREE.Group();
  private readonly shadow: THREE.Mesh;
  private readonly obstacleMeshes = new Map<Obstacle, THREE.Object3D>();
  private readonly dashes: THREE.Mesh[] = [];
  private readonly posts: THREE.Object3D[] = [];
  private readonly clouds: THREE.Mesh[] = [];
  private readonly coinMeshes = new Map<Coin, THREE.Mesh>();
  private readonly shadowWidth: number;
  private aspect = 1;
  private readonly materials = {
    wall: new THREE.MeshBasicMaterial({ color: CORAL }),
    bar: new THREE.MeshBasicMaterial({ color: INK }),
    ground: new THREE.MeshBasicMaterial({ color: GROUND }),
    lane: new THREE.MeshBasicMaterial({ color: CORAL }),
    edge: new THREE.MeshBasicMaterial({ color: CREAM }),
    pit: new THREE.MeshBasicMaterial({ color: PIT }),
    coin: new THREE.MeshBasicMaterial({ color: COIN_COLOUR }),
    post: new THREE.MeshBasicMaterial({ color: INK }),
    lamp: new THREE.MeshBasicMaterial({ color: CREAM }),
    cloud: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false }),
    sun: new THREE.MeshBasicMaterial({ color: CORAL, fog: false }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 }),
  };

  constructor(canvas: HTMLCanvasElement, metrics: CharacterMetrics, source: RunnerSource) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.scene.background = skyTexture();
    this.scene.fog = new THREE.Fog(CREAM, 22, 78);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(3, 6, 4);
    this.scene.add(sun);

    this.scene.add(this.buildTrack());
    this.buildDashes();
    this.buildBackdrop();
    this.buildPosts();
    this.shadowWidth = metrics.widthUnits * UNIT;
    this.shadow = this.buildShadow();
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
    this.aspect = width / Math.max(1, height);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Places the track, runner and obstacles for the session's current state. */
  sync(session: RunSession): void {
    const runnerX = session.distance + CONFIG.RUNNER_X;
    const lift = session.runnerState.y * UNIT;
    this.runner.position.set(0, lift, 0);
    this.runner.scale.y = session.runnerState.mode === "sliding" ? SLIDE_SCALE : 1;

    // The shadow stays on the ground and shrinks as the runner rises, so a jump reads as height.
    const squeeze = 1 / (1 + lift * 0.9);
    this.shadow.scale.set(this.shadowWidth * squeeze, this.shadowWidth * squeeze * 0.6, 1);

    this.updateCamera(session.speed);

    const travelled = session.distance * UNIT;
    const dashPhase = travelled % DASH_SPACING;
    this.dashes.forEach((dash, i) => {
      dash.position.z = -i * DASH_SPACING + dashPhase;
    });
    const postPhase = travelled % POST_SPACING;
    this.posts.forEach((post, i) => {
      post.position.z = -Math.floor(i / 2) * POST_SPACING + postPhase;
    });
    // Clouds drift sideways at a tenth of the track speed and wrap around.
    this.clouds.forEach((cloud) => {
      const start = cloud.userData["start"] as number;
      cloud.position.x = ((((start + travelled * 0.1) % CLOUD_SPAN) + CLOUD_SPAN) % CLOUD_SPAN) - CLOUD_SPAN / 2;
    });

    this.syncObstacles(session.upcoming(), runnerX);
    this.syncCoins(session.upcomingCoins(), runnerX, session.ticks);
  }

  /** The camera sits still behind the runner; the view widens a little as the run speeds up. */
  private updateCamera(speed: number): void {
    const t = Math.min(1, Math.max(0, (speed - CONFIG.START_SPEED) / (CONFIG.MAX_SPEED - CONFIG.START_SPEED)));
    const fov = FOV_SLOW + (FOV_FAST - FOV_SLOW) * t;
    if (Math.abs(fov - this.camera.fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    // On a tall, narrow screen the view is narrow too, so step back and up until the track fits.
    const pullBack = Math.min(MAX_PULL_BACK, Math.max(1, PORTRAIT_ASPECT / this.aspect));
    this.camera.position.set(0, CAMERA_HEIGHT * (0.6 + 0.4 * pullBack), CAMERA_BACK * pullBack);
    this.camera.lookAt(0, LOOK_AT_HEIGHT, LOOK_AT_AHEAD);
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
      // A pit: a dark slab laid over the track, with bright edges so the gap reads as a hole to jump.
      // Across the track is x, along the track (distance) is z: the pit is as long as the gap, not the track.
      const length = obstacle.width * UNIT;
      const hole = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH, 0.02, length), this.materials.pit);
      hole.position.y = 0.011;
      group.add(hole);
      const edgeGeometry = new THREE.BoxGeometry(TRACK_WIDTH, 0.03, PIT_EDGE);
      for (const side of [-1, 1]) {
        const edge = new THREE.Mesh(edgeGeometry, this.materials.lane);
        edge.position.set(0, 0.016, (side * length) / 2);
        group.add(edge);
      }
      return group;
    }
    if (obstacle.kind === "overhead") {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(obstacle.width * UNIT, BAR_HEIGHT * UNIT, 0.4), this.materials.bar);
      bar.position.y = (obstacle.clearance + BAR_HEIGHT / 2) * UNIT;
      group.add(bar);
      // A coral stripe on the underside shows where to slide.
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(obstacle.width * UNIT, 0.05, 0.42), this.materials.lane);
      stripe.position.y = obstacle.clearance * UNIT;
      group.add(stripe);
      return group;
    }
    // Pinch: two walls with a passage of gapWidth between them, centred on the obstacle.
    const half = (obstacle.gapWidth / 2 + WALL_THICKNESS / 2) * UNIT;
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(WALL_THICKNESS * UNIT, WALL_HEIGHT * UNIT, 0.4), this.materials.wall);
      wall.position.set(side * half, (WALL_HEIGHT / 2) * UNIT, 0);
      group.add(wall);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(WALL_THICKNESS * UNIT * 1.25, 0.12, 0.5), this.materials.edge);
      cap.position.set(side * half, WALL_HEIGHT * UNIT, 0);
      group.add(cap);
    }
    return group;
  }

  private buildTrack(): THREE.Group {
    const group = new THREE.Group();
    const track = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH, 0.02, TRACK_LENGTH), this.materials.ground);
    track.position.set(0, -0.01, -TRACK_LENGTH / 2 + 10);
    group.add(track);
    // Cream kerbs along the track make the speed readable at the edges of the screen.
    for (const side of [-1, 1]) {
      const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, TRACK_LENGTH), this.materials.edge);
      kerb.position.set(side * 4.4, 0.0, -TRACK_LENGTH / 2 + 10);
      group.add(kerb);
    }
    return group;
  }

  private buildDashes(): void {
    const geometry = new THREE.BoxGeometry(0.1, 0.021, 0.8);
    for (let i = 0; i < DASH_COUNT; i++) {
      const dash = new THREE.Mesh(geometry, this.materials.lane);
      dash.position.set(0, 0.0, -i * DASH_SPACING);
      this.dashes.push(dash);
      this.scene.add(dash);
    }
  }

  /** Sun, hills and clouds far behind the track. Only the clouds move, drifting slowly. */
  private buildBackdrop(): void {
    const sun = new THREE.Mesh(new THREE.CircleGeometry(15, 48), this.materials.sun);
    sun.position.set(14, 20, -170);
    this.scene.add(sun);

    // x, z, radius, height, colour
    const hillSpecs: readonly (readonly [number, number, number, number, number])[] = [
      [-46, -120, 34, 22, HILL_FAR],
      [10, -135, 42, 28, HILL_FAR],
      [58, -118, 30, 18, HILL_FAR],
      [-24, -92, 26, 14, HILL_NEAR],
      [34, -88, 28, 12, HILL_NEAR],
    ];
    for (const [x, z, radius, height, colour] of hillSpecs) {
      // No fog on hills: fog is cream, and it would bleach them into snow caps.
      const hill = new THREE.Mesh(
        new THREE.ConeGeometry(radius, height, 5),
        new THREE.MeshBasicMaterial({ color: colour, fog: false }),
      );
      hill.position.set(x, height / 2 - 0.2, z);
      this.scene.add(hill);
    }

    const cloudGeometry = new THREE.SphereGeometry(1, 12, 8);
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const cloud = new THREE.Mesh(cloudGeometry, this.materials.cloud);
      cloud.scale.set(5 + (i % 3) * 2, 1.2 + (i % 2) * 0.5, 1.4);
      cloud.userData["start"] = i * (CLOUD_SPAN / CLOUD_COUNT);
      cloud.position.set(0, 9 + (i % 4) * 2.2, -70 - (i % 3) * 18);
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
  }

  /** Lamp posts along both sides of the track. They scroll with the track and sell the speed. */
  private buildPosts(): void {
    const poleGeometry = new THREE.BoxGeometry(0.12, POST_HEIGHT, 0.12);
    const lampGeometry = new THREE.BoxGeometry(0.34, 0.34, 0.34);
    for (let i = 0; i < POST_COUNT * 2; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const post = new THREE.Group();
      const pole = new THREE.Mesh(poleGeometry, this.materials.post);
      pole.position.y = POST_HEIGHT / 2;
      const lamp = new THREE.Mesh(lampGeometry, this.materials.lamp);
      lamp.position.y = POST_HEIGHT + 0.1;
      post.add(pole, lamp);
      post.position.set(side * POST_SIDE, 0, -Math.floor(i / 2) * POST_SPACING);
      this.posts.push(post);
      this.scene.add(post);
    }
  }

  private buildShadow(): THREE.Mesh {
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2), this.materials.shadow);
    shadow.position.y = 0.014;
    shadow.scale.set(this.shadowWidth, this.shadowWidth * 0.6, 1);
    this.scene.add(shadow);
    return shadow;
  }
}

/** A sprite on a flat card, standing on the track and facing the camera. */
function buildSpriteBillboard(image: HTMLImageElement, metrics: CharacterMetrics): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, fog: false });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(metrics.widthUnits * UNIT, metrics.heightUnits * UNIT), material);
  card.position.y = (metrics.heightUnits * UNIT) / 2;
  whenLoaded(image, () => {
    const canvas = buildSpriteCanvas(image);
    if (!canvas) return;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const pixelArt = Math.max(image.naturalWidth, image.naturalHeight) <= PIXEL_ART_MAX_SIDE;
    texture.magFilter = pixelArt ? THREE.NearestFilter : THREE.LinearFilter;
    texture.anisotropy = 4;
    material.map = texture;
    material.needsUpdate = true;
    // The canvas has a sticker border around the picture, so the card grows by the same ratio.
    card.scale.set(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight, 1);
  });
  return card;
}

function whenLoaded(image: HTMLImageElement, onReady: () => void): void {
  if (image.complete && image.naturalWidth > 0) onReady();
  else image.addEventListener("load", onReady, { once: true });
}
