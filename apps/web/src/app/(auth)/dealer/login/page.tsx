import type { AuthProvidersResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthHeading, AuthShell } from '@/components/auth/auth-shell';
import { GoogleSignInButton } from '@/components/auth/google-button';
import { Banner } from '@/components/ui/primitives';
import { apiGet } from '@/lib/api';
import { currentSession, destinationFor } from '@/lib/session';

export const dynamic = 'force-dynamic';

const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: false };

export const metadata: Metadata = {
  title: 'Sign in',
  robots: PRIVATE_ROBOTS,
};

const ERRORS: Record<string, string> = {
  sign_in_failed: 'That sign-in could not be verified. Please try again.',
  identity_unverified:
    'Google could not confirm that account. Check that your Google email is verified, then try again.',
  google_declined: 'Sign-in was cancelled at Google. Nothing has changed.',
  invalid_callback: 'That sign-in link was incomplete. Please start again.',
  account_link_required:
    'A Dealers-Drive account already uses that email address. Contact support to link Google sign-in to it.',
  account_suspended: 'This account has been suspended. Contact support to restore access.',
  session_expired: 'Your session has ended. Sign in again to continue.',
};

export default async function DealerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  const session = await currentSession();
  if (session) redirect(destinationFor(session));

  const { error, returnTo } = await searchParams;
  const providers = await apiGet<AuthProvidersResponse>('/v1/auth/providers', {
    revalidate: false,
  });

  const startUrl = returnTo
    ? `${providers.google.startUrl}?returnTo=${encodeURIComponent(returnTo)}`
    : providers.google.startUrl;

  return (
    <AuthShell>
      <AuthHeading title="Sign in to your dealer account">
        Use the Google account for your dealership. We never see your password — Google confirms
        it&rsquo;s you, and we take it from there.
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

      <GoogleSignInButton href={startUrl} disabled={!providers.google.enabled} />

      <p className="mt-[14px] text-center text-[12px] ink-subtle">
        By continuing you agree to list only vehicles you own or are authorised to sell.
      </p>

      <div className="my-[22px] h-px bg-(--color-divider)" />

      <p className="text-center text-[13px] ink-muted">
        <span className="font-medium ink-body">New dealership?</span> The same button creates your
        account — we&rsquo;ll ask for your business details next.
      </p>
    </AuthShell>
  );
}
