export function salesDocumentBase(dealerId: string): string {
  return `/api/sales/dealers/${encodeURIComponent(dealerId)}/documents`;
}
