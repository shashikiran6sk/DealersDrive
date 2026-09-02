import Link from 'next/link';
import type { ReactNode } from 'react';

import { Plate } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

/**
 * DESIGN-SPEC §3.9 — the shell every authentication screen sits in.
 *
 * A centred 560px column on white, with the brand row above it: logo plate,
 * wordmark, and a ghost link back to the marketplace on the right. Sign-in,
 * onboarding and the admin console all use it, which is what keeps the three
 * screens recognisably one product rather than three forms.
 *
 * Deliberately not a route layout: `/dealer/login` and `/dealer/onboarding` are
 * pages, but `/admin/login` lives under a different segment, and a shared
 * component crosses that boundary where a layout cannot.
 */
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

/** `h1-page` plus the 15px 65% line that follows it on every auth screen. */
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
