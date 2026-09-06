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
  /**
   * Field-level refusals, keyed by the path the API answers with
   * (`body.address.city`). Only `updateDealerAction` returns them — it is the
   * one action here that renders a form rather than a single reason box.
   */
  errors?: Record<string, string>;
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

export async function reinstateDealerAction(dealerId: string, input: unknown) {
  return respond('reinstateDealer', dealerId, input);
}

/**
 * The two KYC decisions. They are keyed by document rather than by dealer, so
 * `dealerId` above carries the document id for these — the stub records what
 * was called with what, and a story asserts on the pair.
 */
export async function verifyDocumentAction(documentId: string) {
  return respond('verifyDocument', documentId, undefined);
}

export async function rejectDocumentAction(documentId: string, input: unknown) {
  return respond('rejectDocument', documentId, input);
}

/**
 * The two refusals, which are two different things behind one word.
 *
 * `requestDealerChanges` hands the application back as a draft with everything
 * in it; `rejectDealer` deletes the application. The stub records which was
 * called, which is the point — the console's job is to make a moderator's
 * choice between them deliberate, and a story asserts on the pair.
 */
export async function rejectDealerAction(dealerId: string, input: unknown) {
  return respond('rejectDealer', dealerId, input);
}

export async function requestDealerChangesAction(dealerId: string, input: unknown) {
  return respond('requestDealerChanges', dealerId, input);
}

/** D3 — the console amending the dealer's own answers. */
export async function updateDealerAction(dealerId: string, input: unknown) {
  return respond('updateDealer', dealerId, input);
}
