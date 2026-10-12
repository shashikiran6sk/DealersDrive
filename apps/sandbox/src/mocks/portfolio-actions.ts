import type { PortfolioDecisionResponse } from '@dealers-drive/contracts';

export interface PortfolioActionResult {
  ok: boolean;
  message?: string;
  decision?: PortfolioDecisionResponse;
}

export const portfolioActionStub: {
  delayMs: number;
  result: PortfolioActionResult;
  calls: { action: string; photoId: string; reason?: string; dealerSlug?: string }[];
} = {
  delayMs: 800,
  result: { ok: true },
  calls: [],
};

async function respond(
  action: string,
  photoId: string,
  dealerSlug?: string,
  reason?: string,
): Promise<PortfolioActionResult> {
  portfolioActionStub.calls.push({ action, photoId, dealerSlug, reason });
  await new Promise((resolve) => setTimeout(resolve, portfolioActionStub.delayMs));
  return portfolioActionStub.result;
}

export function approvePortfolioPhotoAction(
  photoId: string,
  dealerSlug?: string,
): Promise<PortfolioActionResult> {
  return respond('approve', photoId, dealerSlug);
}

export function rejectPortfolioPhotoAction(
  photoId: string,
  reason: string,
  dealerSlug?: string,
): Promise<PortfolioActionResult> {
  return respond('reject', photoId, dealerSlug, reason);
}

export function takeDownPortfolioPhotoAction(
  photoId: string,
  reason: string,
  dealerSlug?: string,
): Promise<PortfolioActionResult> {
  return respond('takeDown', photoId, dealerSlug, reason);
}
