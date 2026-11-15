export type DownloadLinkResult =
  { ok: true; url: string; fileName: string } | { ok: false; message: string };

export async function submittedPhotosDownloadAction(
  _listingId: string,
  mediaId?: string,
): Promise<DownloadLinkResult> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return {
    ok: true,
    url: '#download',
    fileName: mediaId
      ? '2016-hyundai-creta-sx-01-front-three-quarter-driver-side.jpg'
      : '2016-hyundai-creta-sx.zip',
  };
}
