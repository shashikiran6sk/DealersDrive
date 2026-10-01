export type TeamActionResult = { ok: true } | { ok: false; message: string };

export const teamActionStub: { delayMs: number; result: TeamActionResult; calls: string[] } = {
  delayMs: 600,
  result: { ok: true },
  calls: [],
};

async function settle(call: string): Promise<TeamActionResult> {
  teamActionStub.calls.push(call);
  await new Promise((resolve) => setTimeout(resolve, teamActionStub.delayMs));
  return teamActionStub.result;
}

export function inviteMemberAction(phone: string, role: string): Promise<TeamActionResult> {
  return settle(`invite ${phone} ${role}`);
}

export function revokeInvitationAction(invitationId: string): Promise<TeamActionResult> {
  return settle(`revoke ${invitationId}`);
}

export function changeMemberRoleAction(memberId: string, role: string): Promise<TeamActionResult> {
  return settle(`role ${memberId} ${role}`);
}

export function removeMemberAction(memberId: string): Promise<TeamActionResult> {
  return settle(`remove ${memberId}`);
}
