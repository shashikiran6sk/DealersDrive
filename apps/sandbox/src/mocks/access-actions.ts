/**
 * A stand-in for `@/features/admin/access-actions` (**C-4**).
 *
 * `AdminAccessPanel` is the one screen that hands out a cross-tenant seat, and
 * both of its writes are Server Actions. The stub records what it was asked to
 * do so a story can show the call, and delays so the pending state is visible.
 */
export interface AccessResult {
  ok: boolean;
  message?: string;
  entry?: Record<string, unknown>;
}

export const accessActionStub: {
  delayMs: number;
  result: AccessResult;
  calls: { action: 'grant' | 'revoke'; input: unknown }[];
} = {
  delayMs: 700,
  result: { ok: true },
  calls: [],
};

async function respond(action: 'grant' | 'revoke', input: unknown): Promise<AccessResult> {
  accessActionStub.calls.push({ action, input });
  await new Promise((resolve) => setTimeout(resolve, accessActionStub.delayMs));
  return accessActionStub.result;
}

export function grantAdminAccessAction(input: {
  email: string;
  adminRole: string;
}): Promise<AccessResult> {
  return respond('grant', input);
}

export function revokeAdminAccessAction(userId: string): Promise<AccessResult> {
  return respond('revoke', userId);
}
