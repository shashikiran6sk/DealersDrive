export type LifecycleResult = { ok: true } | { ok: false; message: string };

export const listingLifecycleActionStub: {
  delayMs: number;
  result: LifecycleResult;
  calls: { vehicleId: string; action: string; body: unknown }[];
} = {
  delayMs: 700,
  result: { ok: true },
  calls: [],
};

export async function listingLifecycleAction(
  vehicleId: string,
  action: string,
  body?: unknown,
): Promise<LifecycleResult> {
  listingLifecycleActionStub.calls.push({ vehicleId, action, body });
  await new Promise((resolve) => setTimeout(resolve, listingLifecycleActionStub.delayMs));
  return listingLifecycleActionStub.result;
}
