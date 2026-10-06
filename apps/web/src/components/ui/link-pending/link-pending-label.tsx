'use client';

import { useLinkStatus } from 'next/link';
import type { ReactNode } from 'react';

import { Spinner } from '@/components/ui/button/spinner';

import { LINK_PENDING_TEXT } from './link-pending.constants';

export function LinkPendingLabel({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();

  if (!pending) return <>{children}</>;

  return (
    <>
      <span className="invisible contents">{children}</span>
      <span
        data-pending=""
        role="status"
        aria-label={LINK_PENDING_TEXT.loading}
        className="dd-pending absolute inset-0 grid place-items-center"
      >
        <Spinner />
      </span>
    </>
  );
}
