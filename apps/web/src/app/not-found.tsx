import type { Metadata } from 'next';

import { NotFoundState, STATUS_TEXT } from '@/components/errors/status-page';
import { PublicShell } from '@/components/layout/public-shell';

export const metadata: Metadata = { title: STATUS_TEXT.notFound.metaTitle };

export default function NotFound() {
  return (
    <PublicShell>
      <NotFoundState />
    </PublicShell>
  );
}
