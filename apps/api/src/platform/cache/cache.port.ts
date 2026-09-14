export interface CounterResult {
  count: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export interface CachePort {
  readonly driver: 'memory' | 'postgres';

  increment(key: string, windowSeconds: number): Promise<CounterResult>;

  peek(key: string): Promise<number>;

  bumpVersion(namespace: string): Promise<number>;

  readVersion(namespace: string): Promise<number>;

  sweep(): Promise<number>;

  ping(): Promise<void>;

  reset(): Promise<void>;

  close(): Promise<void>;
}

export function retryAfterSeconds(
  resetAt: number,
  now: number = Date.now(),
  windowSeconds?: number,
): number {
  const remaining = Math.max(1, Math.ceil((resetAt - now) / 1000));
  return windowSeconds === undefined ? remaining : Math.min(remaining, windowSeconds);
}
