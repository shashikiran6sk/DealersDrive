/**
 * Where the process is in its own life, readable from a request handler.
 *
 * It exists for one narrow reason: **a task that is shutting down must fail its
 * readiness check before it stops accepting connections** (§20.10).
 *
 * The order matters and is easy to get backwards. If SIGTERM closes the
 * listener first, every request the load balancer had already routed — and
 * every one it routes in the seconds before its next health check — is met with
 * a connection reset. Those show up as 502s during a deploy and look like the
 * new version is broken. Answering 503 on `/health/ready` first tells the
 * target group to take this task out of rotation while it is still perfectly
 * able to finish the work it already has.
 *
 * `/health/live` is deliberately unaffected: the process *is* alive, and a
 * liveness probe that fails during a graceful drain gets the container killed
 * mid-drain, which is the opposite of what any of this is for.
 */
let draining = false;
let drainingSince: number | undefined;

/** True once a shutdown signal has been received. */
export function isDraining(): boolean {
  return draining;
}

/** Milliseconds since the drain began, or undefined if not draining. */
export function drainingForMs(): number | undefined {
  return drainingSince === undefined ? undefined : Date.now() - drainingSince;
}

/** Idempotent — a second SIGTERM must not restart the clock. */
export function beginDraining(): void {
  if (draining) return;
  draining = true;
  drainingSince = Date.now();
}

/** Test-suite affordance. Never called by application code. */
export function resetLifecycle(): void {
  draining = false;
  drainingSince = undefined;
}
