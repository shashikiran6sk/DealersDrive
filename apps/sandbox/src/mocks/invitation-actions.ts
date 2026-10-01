export type InvitationResult = { ok: true } | { ok: false; message: string };

export const invitationActionStub: { delayMs: number; result: InvitationResult } = {
  delayMs: 600,
  result: { ok: true },
};

async function settle(): Promise<InvitationResult> {
  await new Promise((resolve) => setTimeout(resolve, invitationActionStub.delayMs));
  return invitationActionStub.result;
}

export function acceptInvitationAction(_invitationId: string): Promise<InvitationResult> {
  return settle();
}

export function declineInvitationAction(_invitationId: string): Promise<InvitationResult> {
  return settle();
}
