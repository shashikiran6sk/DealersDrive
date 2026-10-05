'use client';

import { useLinkStatus } from 'next/link';

import { Spinner } from '@/components/ui/button/spinner';

import { LINK_PENDING_TEXT } from './link-pending.constants';

const BASE = 'inline-flex flex-none items-center justify-center';
const DEFAULT_BOX = 'size-[14px]';

export interface LinkPendingIndicatorProps {
  className?: string;
  reserve?: boolean;
}

export function LinkPendingIndicator({
  className = DEFAULT_BOX,
  reserve = false,
}: LinkPendingIndicatorProps) {
  const { pending } = useLinkStatus();

  if (!pending) {
    return reserve ? <span aria-hidden="true" className={`${BASE} ${className}`} /> : null;
  }

  return (
    <span
      data-pending=""
      role="status"
      aria-label={LINK_PENDING_TEXT.loading}
      className={`dd-pending ${BASE} ${className}`}
    >
      <Spinner />
    </span>
  );
}
