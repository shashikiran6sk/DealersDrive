const SAFE_NAME = /^[A-Za-z0-9._-]{1,200}$/;

export function isSafeDownloadName(name: string): boolean {
  return SAFE_NAME.test(name);
}

export function attachmentDisposition(name: string): string {
  return isSafeDownloadName(name) ? `attachment; filename="${name}"` : 'attachment';
}
