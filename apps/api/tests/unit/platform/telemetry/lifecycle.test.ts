import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginDraining,
  drainingForMs,
  isDraining,
  resetLifecycle,
} from '../../../../src/platform/telemetry/lifecycle.js';

/**
 * Unit tests for the drain flag.
 *
 * It exists so `/health/ready` can start failing *before* the listener closes.
 * Getting that order backwards is what turns a routine deploy into a burst of
 * 502s: the load balancer keeps routing to a task whose socket has already gone
 * away (§20.10).
 */
beforeEach(() => {
  resetLifecycle();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  resetLifecycle();
});

describe('before a signal', () => {
  it('is not draining', () => {
    expect(isDraining()).toBe(false);
  });

  it('reports no drain duration', () => {
    expect(drainingForMs()).toBeUndefined();
  });
});

describe('after a signal', () => {
  it('is draining', () => {
    beginDraining();

    expect(isDraining()).toBe(true);
  });

  it('starts the clock', () => {
    beginDraining();
    vi.advanceTimersByTime(2_500);

    expect(drainingForMs()).toBe(2_500);
  });

  /**
   * ECS sends SIGTERM and, if the task is still there when stopTimeout
   * elapses, SIGKILL — but an operator pressing Ctrl-C twice sends two
   * SIGINTs. Restarting the clock on the second would make the drain budget
   * unbounded.
   */
  it('is idempotent — a second signal does not restart the clock', () => {
    beginDraining();
    vi.advanceTimersByTime(1_000);
    beginDraining();
    vi.advanceTimersByTime(1_000);

    expect(drainingForMs()).toBe(2_000);
  });
});
