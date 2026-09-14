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
    <main className={cn('mx-auto w-full max-w-[560px] px-6 pb-[70px] pt-[52px]', className)}>
      <div className="mb-[34px] flex items-center gap-[9px]">
        <Plate size="logo">DD</Plate>
        <span className="font-heading text-[15px] font-semibold">{eyebrow}</span>
        <Link href="/" className="ml-auto text-[13px] text-(--color-accent) no-underline">
          {AUTH_SHELL_TEXT.backToMarketplace}
        </Link>
      </div>

      {children}
    </main>
  );
}
