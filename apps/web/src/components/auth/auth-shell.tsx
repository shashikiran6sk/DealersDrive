import Link from 'next/link';
import type { ReactNode } from 'react';

import { Plate } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

export function AuthShell({
  eyebrow = 'Dealers-Drive for dealers',
  children,
  className,
}: {
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={cn('mx-auto w-full max-w-[560px] px-6 pb-[70px] pt-[52px]', className)}>
      <div className="mb-[34px] flex items-center gap-[9px]">
        <Plate size="logo">DD</Plate>
        <span className="font-heading text-[15px] font-semibold">{eyebrow}</span>
        <Link href="/" className="ml-auto text-[13px] text-(--color-accent) no-underline">
          ← Back to marketplace
        </Link>
      </div>

      {children}
    </main>
  );
}

export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-[26px]">
      <h1 className="font-heading text-[34px] font-semibold leading-[1.1] tracking-[-0.02em]">
        {title}
      </h1>
      {children ? (
        <p className="mt-[10px] text-[15px] leading-[1.5] ink-secondary">{children}</p>
      ) : null}
    </div>
  );
}
