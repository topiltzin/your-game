export interface RateLimitOptions {
  readonly limit: number;
  readonly windowMs: number;
  /** Counts job creations by this IP hash since the given time. Backed by model_jobs in production. */
  readonly countSince: (ipHash: string, since: Date) => Promise<number>;
}

export interface RateLimiter {
  /** True when this IP hash may create another job now. */
  check(ipHash: string, now: Date): Promise<boolean>;
}

export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  return {
    async check(ipHash, now) {
      const since = new Date(now.getTime() - options.windowMs);
      const used = await options.countSince(ipHash, since);
      return used < options.limit;
    },
  };
}
