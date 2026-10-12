import { DOCUMENT_GAP_LABELS } from '@dealers-drive/contracts';

const ADMIN_GAP_LABELS = new Map<string, string>([
  ...Object.entries(DOCUMENT_GAP_LABELS),
  ['GST_CERTIFICATE', 'GST Registration Certificate (a GSTIN is on file)'],
]);

export function documentGapLabel(code: string): string {
  return ADMIN_GAP_LABELS.get(code) ?? code;
}
