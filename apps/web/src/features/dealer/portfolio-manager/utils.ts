import {
  PortfolioPhotoPresignResponse,
  ProblemDetails,
  type DealerPortfolioPhoto,
} from '@dealers-drive/contracts';

import { postJson, putToStorage, UploadFailure } from '@/lib/upload';

import { PORTFOLIO_TEXT } from './portfolio-manager.constants';
import type { PortfolioPaths, PortfolioSubmission } from './portfolio-manager.types';

export function activeCount(photos: readonly DealerPortfolioPhoto[]): number {
  return photos.filter(
    (photo) =>
      photo.status === 'APPROVED' || (photo.status === 'PENDING' && photo.replacesId === null),
  ).length;
}

export function pendingReplacementTargets(photos: readonly DealerPortfolioPhoto[]): Set<string> {
  const targets = new Set<string>();
  for (const photo of photos) {
    if (photo.status === 'PENDING' && photo.replacesId !== null) targets.add(photo.replacesId);
  }
  return targets;
}

export function positionsOf(photos: readonly DealerPortfolioPhoto[]): Map<string, number> {
  return new Map(photos.map((photo, index) => [photo.id, index + 1]));
}

export async function problemMessage(response: Response, fallback: string): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const problem = ProblemDetails.safeParse(body);
  return problem.success && problem.data.detail ? problem.data.detail : fallback;
}

export async function submitPortfolioPhoto(
  paths: PortfolioPaths,
  file: File,
  { caption, replacesId }: PortfolioSubmission,
): Promise<void> {
  const replaces = replacesId ? { replacesId } : {};

  const started = await postJson(paths.presign, {
    fileName: file.name,
    mimeType: file.type,
    bytes: file.size,
    ...replaces,
  });
  if (!started.ok) {
    throw new UploadFailure(await problemMessage(started, PORTFOLIO_TEXT.startFailed));
  }
  const payload: unknown = await started.json().catch(() => null);
  const signed = PortfolioPhotoPresignResponse.safeParse(payload);
  if (!signed.success) throw new UploadFailure(PORTFOLIO_TEXT.missingId);

  await putToStorage(signed.data, file);

  const trimmed = caption.trim();
  const committed = await postJson(paths.commit, {
    mediaId: signed.data.mediaId,
    ...replaces,
    ...(trimmed ? { caption: trimmed } : {}),
  });
  if (!committed.ok) {
    throw new UploadFailure(await problemMessage(committed, PORTFOLIO_TEXT.commitFailed));
  }
}

export async function removePortfolioPhoto(paths: PortfolioPaths, photoId: string): Promise<void> {
  const response = await fetch(`${paths.remove}/${encodeURIComponent(photoId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new UploadFailure(await problemMessage(response, PORTFOLIO_TEXT.removeFailed));
  }
}
