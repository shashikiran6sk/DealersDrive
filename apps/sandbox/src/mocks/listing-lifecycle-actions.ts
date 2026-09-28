export type LifecycleResult = { ok: true } | { ok: false; message: string };

export const listingLifecycleActionStub: {
  delayMs: number;
  result: LifecycleResult;
  calls: { vehicleId: string; action: string; withdrawal: unknown }[];
} = {
  delayMs: 700,
  result: { ok: true },
  calls: [],
};

export async function listingLifecycleAction(
  vehicleId: string,
  action: string,
  withdrawal?: unknown,
): Promise<LifecycleResult> {
  listingLifecycleActionStub.calls.push({ vehicleId, action, withdrawal });
  await new Promise((resolve) => setTimeout(resolve, listingLifecycleActionStub.delayMs));
  return listingLifecycleActionStub.result;
}
