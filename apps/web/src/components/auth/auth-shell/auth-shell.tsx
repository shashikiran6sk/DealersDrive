import Link from 'next/link';
import type { ReactNode } from 'react';

import { Plate } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

import { AUTH_SHELL_TEXT } from './auth-shell.constants';

export interface AuthShellProps {
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}

export function AuthShell({
  eyebrow = AUTH_SHELL_TEXT.defaultEyebrow,
  children,
  className,
}: AuthShellProps) {
  return (
    <main
      className={cn('mx-auto w-full max-w-[560px] px-5 pb-[70px] pt-[40px] sm:px-8', className)}
    >
      <div className="mb-[30px] flex flex-wrap items-center gap-x-[10px] gap-y-2">
        <Plate size="logo">DD</Plate>
        <span className="font-heading text-[16px] font-extrabold tracking-[-0.02em]">
          {eyebrow}
        </span>
        <Link href="/" className="ml-auto text-[13px] font-bold text-(--color-ink) hover:underline">
          {AUTH_SHELL_TEXT.backToMarketplace}
        </Link>
      </div>

      {children}
    </main>
  );
}
