import 'server-only';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function yardVisitPhotoPath(
  dealerId: string,
  visitId: string,
  step: 'presign' | 'commit',
): string | null {
  if (!UUID.test(dealerId) || !UUID.test(visitId)) return null;
  return `/v1/admin/dealers/${dealerId}/yard-visits/${visitId}/photos/${step}`;
}
