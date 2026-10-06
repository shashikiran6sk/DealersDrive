import type { AdminMemberDto } from '@dealers-drive/contracts';

export interface MemberActionResult {
  ok: boolean;
  message?: string;
  member?: AdminMemberDto;
}

export const memberActionStub: {
  delayMs: number;
  result: MemberActionResult;
  calls: string[];
} = {
  delayMs: 600,
  result: { ok: true },
  calls: [],
};

async function settle(call: string): Promise<MemberActionResult> {
  memberActionStub.calls.push(call);
  await new Promise((resolve) => setTimeout(resolve, memberActionStub.delayMs));
  return memberActionStub.result;
}

export function inviteMemberAction(input: {
  email: string;
  name: string;
  role: string;
}): Promise<MemberActionResult> {
  return settle(`invite ${input.email} ${input.role}`);
}

export function changeMemberRoleAction(id: string, role: string): Promise<MemberActionResult> {
  return settle(`role ${id} ${role}`);
}

export function disableMemberAction(id: string, reason: string): Promise<MemberActionResult> {
  return settle(`disable ${id} ${reason}`);
}

export function activateMemberAction(id: string): Promise<MemberActionResult> {
  return settle(`activate ${id}`);
}
