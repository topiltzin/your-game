export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds left to live. */
  life: number;
}

export interface PoolOptions {
  /** False under reduced motion: nothing is spawned, gameplay is unchanged. */
  enabled?: boolean;
}

/** Fixed-size particle pool. Spawns beyond the cap are dropped, so effects never grow unbounded. */
export class ParticlePool {
  private readonly particles: Particle[] = [];
  private readonly enabled: boolean;

  constructor(
    private readonly cap: number,
    options: PoolOptions = {},
  ) {
    this.enabled = options.enabled ?? true;
  }

  spawn(particle: Particle): void {
    if (!this.enabled || this.particles.length >= this.cap) return;
    this.particles.push({ ...particle });
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  active(): number {
    return this.particles.length;
  }

  /** Read-only view for the renderer. */
  list(): readonly Particle[] {
    return this.particles;
  }
}
