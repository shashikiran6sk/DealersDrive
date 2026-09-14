let draining = false;
let drainingSince: number | undefined;

export function isDraining(): boolean {
  return draining;
}

export function drainingForMs(): number | undefined {
  return drainingSince === undefined ? undefined : Date.now() - drainingSince;
}

export function beginDraining(): void {
  if (draining) return;
  draining = true;
  drainingSince = Date.now();
}

export function resetLifecycle(): void {
  draining = false;
  drainingSince = undefined;
}
