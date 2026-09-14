export interface AdminResult<T = undefined> {
  ok: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string>;
}

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

export async function verifyDocumentAction(documentId: string) {
  return respond('verifyDocument', documentId, undefined);
}

export async function rejectDocumentAction(documentId: string, input: unknown) {
  return respond('rejectDocument', documentId, input);
}

export async function rejectDealerAction(dealerId: string, input: unknown) {
  return respond('rejectDealer', dealerId, input);
}

export async function requestDealerChangesAction(dealerId: string, input: unknown) {
  return respond('requestDealerChanges', dealerId, input);
}

export async function updateDealerAction(dealerId: string, input: unknown) {
  return respond('updateDealer', dealerId, input);
}

export async function approveProfileChangeAction(changeId: string) {
  return respond('approveProfileChange', changeId, undefined);
}

export async function rejectProfileChangeAction(changeId: string, input: unknown) {
  return respond('rejectProfileChange', changeId, input);
}
