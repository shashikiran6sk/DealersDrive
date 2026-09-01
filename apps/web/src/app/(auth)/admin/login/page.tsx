import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthHeading, AuthShell } from '@/components/auth/auth-shell';
import { AdminLoginForm } from '@/features/auth/admin-login-form';
import { currentAdmin } from '@/lib/session';
import { seoMetadata } from '@/lib/seo';

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

export const metadata: Metadata = {
  title: 'Admin sign-in',
  ...seoMetadata({ kind: 'private' }),
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
