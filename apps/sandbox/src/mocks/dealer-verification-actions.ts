import type { DealerVerificationReview } from '@dealers-drive/contracts';

export const dealerVerificationStub: {
  delayMs: number;
  calls: { dealerId: string; input: unknown }[];
} = { delayMs: 800, calls: [] };

export async function decideDealerVerification(
  dealerId: string,
  input: unknown,
): Promise<{ ok: true; review: DealerVerificationReview } | { ok: false; message: string }> {
  dealerVerificationStub.calls.push({ dealerId, input });
  await new Promise((resolve) => setTimeout(resolve, dealerVerificationStub.delayMs));
  return { ok: false, message: 'Sandbox: decisions are not saved.' };
}
