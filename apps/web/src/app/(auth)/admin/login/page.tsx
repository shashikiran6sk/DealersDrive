import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthHeading, AuthShell } from '@/components/auth/auth-shell';
import { AdminLoginForm } from '@/features/auth/admin-login-form';
import { currentAdmin } from '@/lib/session';

/**
 * The admin console's only door.
 *
 * There is no sign-up link on this page because there is no admin sign-up: an
 * admin is created by the seed or by another admin, and a public registration
 * route into an operations console would be a way to grant yourself moderation
 * rights. There is no Google button either — the two consoles do not share an
 * identity provider or a session scope.
 */
export const dynamic = 'force-dynamic';

/*
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline spreads `seoMetadata({ kind: 'private' })` from `lib/seo.ts`
 * here. That file is the whole indexing policy in one function and belongs to
 * **F095**, which brings it and its tests; what it resolves to for a `private`
 * route is the literal below, and a sign-in screen must be `noindex` from the
 * day it exists rather than from the day the SEO feature lands.
 */
const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: false };

export const metadata: Metadata = {
  title: 'Admin sign-in',
  robots: PRIVATE_ROBOTS,
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Verified with the API, not read from the cookie jar — see the dealer
  // sign-in screen for why that distinction is load-bearing.
  if (await currentAdmin()) redirect('/admin');

  const { error } = await searchParams;

  return (
    <AuthShell eyebrow="Dealers-Drive operations">
      <AuthHeading title="Admin sign-in">
        For Dealers-Drive staff. Dealers sign in from the{' '}
        <a href="/dealer/login" className="text-(--color-accent)">
          dealer console
        </a>
        .
      </AuthHeading>

      <AdminLoginForm
        initialMessage={
          error === 'session_expired' ? 'Your session has ended. Sign in again.' : undefined
        }
      />
    </AuthShell>
  );
}
