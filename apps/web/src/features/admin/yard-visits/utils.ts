import { UploadFailure, postJson, presign, putToStorage } from '@/lib/upload';

import { YARD_VISITS_TEXT, yardVisitPhotoPaths } from './yard-visits.constants';

export async function uploadYardVisitPhoto(
  dealerId: string,
  visitId: string,
  file: File,
): Promise<void> {
  const paths = yardVisitPhotoPaths(dealerId, visitId);
  const signed = await presign(paths.presign, {
    fileName: file.name,
    mimeType: file.type,
    bytes: file.size,
  });
  const mediaId = signed.mediaId;
  if (!mediaId) throw new UploadFailure(YARD_VISITS_TEXT.missingId);

  await putToStorage(signed, file);

  const commit = await postJson(paths.commit, { mediaId });
  if (!commit.ok) throw new UploadFailure(YARD_VISITS_TEXT.commitFailed);
}
