import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { STATUS_TEXT } from './status-page.constants';

export interface StatusPageProps {
  code: string;
  title: string;
  description: string;
  actions: ReactNode;
  reference?: string | undefined;
  className?: string;
}

export function StatusPage({
  code,
  title,
  description,
  actions,
  reference,
  className,
}: StatusPageProps) {
  return (
    <section
      aria-labelledby="status-title"
      className={cn(
        'mx-auto flex w-full max-w-[640px] flex-col items-center px-4 py-[64px] text-center sm:px-6 md:py-[104px]',
        className,
      )}
    >
      <p className="eyebrow tnum">{code}</p>
      <h1
        id="status-title"
        className="mt-[12px] text-[32px] leading-[1.1] tracking-[-0.035em] sm:text-[40px]"
      >
        {title}
      </h1>
      <p className="mt-[12px] max-w-[46ch] text-[15px] leading-[1.6] ink-muted">{description}</p>
      <div className="mt-[28px] flex w-full flex-col items-stretch justify-center gap-[10px] sm:w-auto sm:flex-row sm:items-center">
        {actions}
      </div>
      {reference ? (
        <p className="mt-[24px] text-[12px] ink-muted">
          {STATUS_TEXT.reference} <span className="font-mono">{reference}</span>
        </p>
      ) : null}
    </section>
  );
}
