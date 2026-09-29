import type { Metadata } from 'next';

import { NotFoundState, STATUS_TEXT } from '@/components/errors/status-page';

export const metadata: Metadata = { title: STATUS_TEXT.notFound.metaTitle };

export default function PublicNotFound() {
  return <NotFoundState />;
}
