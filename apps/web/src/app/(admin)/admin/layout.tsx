import type { AdminOverview } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { redirect } from 'next/navigation';

import { AdminNav } from '@/components/admin/admin-nav';
import { StatusTag } from '@/components/ui/primitives';
import { SignOutButton } from '@/features/auth/sign-out';
import { ApiError, apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: false };

export const metadata: Metadata = {
  title: { default: 'Admin console', template: '%s · Admin' },
  robots: PRIVATE_ROBOTS,
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const overview = await requireAdmin();

  return (
    <div className="flex min-h-dvh bg-(--color-neutral-100) max-md:flex-col">
      <aside className="flex w-[206px] flex-none flex-col gap-4 bg-(--color-accent-900) px-[10px] py-[18px] text-white max-md:w-full max-md:flex-row max-md:items-center max-md:gap-3 max-md:py-3">
        <Link href="/admin" className="flex items-center gap-[9px] no-underline">
          <span className="border border-white/40 px-[7px] py-[2px] font-mono text-[11px] text-white">
            DD
          </span>
          <span className="font-heading text-[15px] font-semibold text-white">Admin console</span>
        </Link>

        <div className="max-md:ml-auto max-md:overflow-x-auto">
          <div className="max-md:flex max-md:gap-1">
            <AdminNav />
          </div>
        </div>

        <p className="mt-auto text-[11px] leading-[1.5] text-white/55 max-md:hidden">
          Ops build · read/write
          <br />
          logged to audit trail
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[15] flex h-[54px] flex-none items-center gap-3 border-b border-(--color-divider) bg-white px-5">
          <span className="text-[14px] font-semibold">Operations</span>

          <div className="ml-auto flex items-center gap-3">
            {overview.headerBadge.count > 0 ? (
              <Link href="/admin/listings" className="no-underline">
                <StatusTag tone={overview.headerBadge.tone}>{overview.headerBadge.label}</StatusTag>
              </Link>
            ) : null}
            <span className="text-[12px] ink-muted">{overview.operator.email}</span>
            <SignOutButton scope="admin" />
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

async function requireAdmin(): Promise<AdminOverview> {
  try {
    return await apiGet<AdminOverview>('/v1/admin/metrics/overview', { revalidate: false });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect('/admin/login?error=session_expired');
    }
    throw error;
  }
}
