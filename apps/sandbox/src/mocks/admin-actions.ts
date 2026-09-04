/**
 * A stand-in for `@/features/admin/actions`.
 *
 * The same coupling as `auth-actions.ts` (**C-4** in `component-map.md`):
 * `DealerAdminActions` calls Server Actions, which need a Next server, and the
 * sandbox renders with the network off. `.storybook/main.ts` aliases the real
 * module to this one.
 *
 * The stubs are deliberately *slow and observable* rather than instant. The
 * pending state is one of the states the story has to show, and an action that
 * resolved immediately would make it impossible to see — which matters more
 * here than at sign-in, because these two writes are the ones that put a
 * dealership's whole catalogue in front of buyers or take it away.
 */
export interface AdminResult<T = undefined> {
  ok: boolean;
  message?: string;
  data?: T;
}

/** What the sandbox's actions do next. Set by a story before it renders. */
export const adminActionStub: {
  delayMs: number;
  result: AdminResult<Record<string, unknown>>;
  calls: { action: string; dealerId: string; input: unknown }[];
} = {
  delayMs: 900,
  result: { ok: true },
  calls: [],
};

async function respond(
  action: string,
  dealerId: string,
  input: unknown,
): Promise<AdminResult<Record<string, unknown>>> {
  adminActionStub.calls.push({ action, dealerId, input });
  await new Promise((resolve) => setTimeout(resolve, adminActionStub.delayMs));
  return adminActionStub.result;
}

export async function approveDealerAction(dealerId: string, input: unknown) {
  return respond('approveDealer', dealerId, input);
}

export async function suspendDealerAction(dealerId: string, input: unknown) {
  return respond('suspendDealer', dealerId, input);
}
