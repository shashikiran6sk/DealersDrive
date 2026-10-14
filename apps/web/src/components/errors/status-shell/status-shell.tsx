import Link from 'next/link';
import type { ReactNode } from 'react';

import { BrandLockup } from '@/components/brand-logo';

export function StatusShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-(--color-divider) bg-white">
        <div className="mx-auto flex h-(--header-height) max-w-[1440px] items-center px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-[10px]">
            <BrandLockup />
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center">{children}</main>
    </div>
  );
}
