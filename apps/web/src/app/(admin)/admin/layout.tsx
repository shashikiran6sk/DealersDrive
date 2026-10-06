import type { AdminOverview } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { redirect } from 'next/navigation';

import { BrandLogo } from '@/components/brand-logo';
import { AdminNav, adminNavFor } from '@/components/admin/admin-nav';
import { StatusTag } from '@/components/ui/primitives';
import { SignOutButton } from '@/features/auth/sign-out';
import { ApiError, apiGet } from '@/lib/api';
import { seoMetadata } from '@/lib/seo';
import { isConsoleRefusal } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Admin console', template: '%s · Admin' },
  ...seoMetadata({ kind: 'private' }),
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const overview = await requireAdmin();

  return (
    <div className="flex min-h-dvh bg-(--color-neutral-100) max-md:flex-col">
      <aside className="flex w-[206px] flex-none flex-col gap-4 bg-(--color-accent-900) px-[10px] py-[18px] text-white max-md:w-full max-md:flex-row max-md:items-center max-md:gap-3 max-md:py-3">
        <Link href="/admin" className="flex items-center gap-[9px] no-underline">
          <BrandLogo variant="dark" size={23} className="h-[23px] w-[29px]" />
          <span className="font-heading text-[15px] font-extrabold text-white">Admin console</span>
        </Link>

        <div className="max-md:ml-auto max-md:overflow-x-auto">
          <div className="max-md:flex max-md:gap-1">
            <AdminNav items={adminNavFor(overview.operator.permissions)} />
          </div>
        </div>

        <p className="mt-auto text-[11px] leading-[1.5] text-white/55 max-md:hidden">
          Ops build · read/write
          <br />
          logged to audit trail
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[15] flex h-[54px] flex-none items-center gap-3 border-b border-(--color-divider) bg-white px-5 max-sm:h-auto max-sm:flex-col max-sm:items-start max-sm:py-3">
          <span className="text-[14px] font-semibold">Operations</span>

          <div className="ml-auto flex min-w-0 items-center gap-3 max-sm:ml-0 max-sm:grid max-sm:w-full max-sm:grid-cols-[minmax(0,1fr)_auto]">
            {overview.headerBadge.count > 0 ? (
              <Link
                href="/admin/listings"
                className="no-underline max-sm:col-span-2 max-sm:justify-self-start"
              >
                <StatusTag tone={overview.headerBadge.tone}>{overview.headerBadge.label}</StatusTag>
              </Link>
            ) : null}
            <span className="min-w-0 text-[12px] break-all ink-muted">
              {overview.operator.email}
            </span>
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
    if (isConsoleRefusal(error)) redirect('/sales');
    throw error;
  }
}
