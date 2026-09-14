import type { AuthProvidersResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthHeading, AuthShell } from '@/components/auth/auth-shell';
import { GoogleSignInButton } from '@/components/auth/google-button';
import { Banner } from '@/components/ui/primitives';
import { apiGet } from '@/lib/api';
import { currentAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: false };

export const metadata: Metadata = {
  title: 'Admin sign-in',
  robots: PRIVATE_ROBOTS,
};

const ERRORS: Record<string, string> = {
  not_authorised:
    'That Google account does not have admin access. Ask the platform team to add your address, then try again.',
  sign_in_failed: 'That sign-in could not be verified. Please try again.',
  identity_unverified:
    'Google could not confirm that account. Check that your Google email is verified, then try again.',
  google_declined: 'Sign-in was cancelled at Google. Nothing has changed.',
  invalid_callback: 'That sign-in link was incomplete. Please start again.',
  account_suspended: 'This account has been suspended.',
  session_expired: 'Your session has ended. Sign in again.',
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await currentAdmin()) redirect('/admin');

  const { error } = await searchParams;
  const providers = await apiGet<AuthProvidersResponse>('/v1/auth/providers', {
    revalidate: false,
  });

  return (
    <AuthShell eyebrow="Dealers-Drive operations">
      <AuthHeading title="Admin sign-in">
        For Dealers-Drive staff. Dealers sign in from the{' '}
        <a href="/dealer/login" className="text-(--color-accent)">
          dealer console
        </a>
        .
      </AuthHeading>

      {error ? (
        <Banner tone="err" className="mb-[18px]">
          {ERRORS[error] ?? 'That sign-in could not be completed. Please try again.'}
        </Banner>
      ) : null}

      {providers.google.enabled ? null : (
        <Banner tone="warn" title="Google sign-in is not configured" className="mb-[18px]">
          {providers.google.reason} Set them in <code className="font-mono">.env</code> and register{' '}
          <code className="font-mono">/v1/auth/google/callback</code> as an authorized redirect URI
          in the Google Cloud console.
        </Banner>
      )}

      <GoogleSignInButton
        href={providers.google.adminStartUrl}
        label="Continue with Google"
        disabled={!providers.google.enabled}
      />

      <p className="mt-[14px] text-center text-[12px] ink-subtle">
        Admin access is granted by address, not by signing in. Accounts that are not on the list are
        refused after Google confirms them.
      </p>
    </AuthShell>
  );
}
