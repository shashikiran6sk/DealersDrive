import type { AuthProvidersResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthHeading, AuthShell } from '@/components/auth/auth-shell';
import { GoogleSignInButton } from '@/components/auth/google-button';
import { Banner } from '@/components/ui/primitives';
import { apiGet } from '@/lib/api';
import { currentAdmin } from '@/lib/session';

/**
 * The admin console's only door.
 *
 * There is no sign-up link because there is no admin sign-up, and there is no
 * password field because there is no admin password: the console is entered by
 * signing in with Google as an address the deployment has allow-listed. A form
 * here would be a second way in, and the second way in is always the one that
 * gets attacked.
 *
 * The button is the *same* button the dealer screen shows, pointed at a
 * different start URL. What differs is what the API does with the address that
 * comes back — everybody may click it; almost nobody is let through.
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

/**
 * Every code the API's callback can send back here.
 *
 * `not_authorised` is the new one and the one that matters: the sign-in
 * *worked* — Google confirmed the account — and the console still refused it.
 * Saying so plainly is better than a vague failure, because the person reading
 * it is usually staff who need to be told to ask for access rather than to try
 * again.
 */
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
  // Verified with the API, not read from the cookie jar — see the dealer
  // sign-in screen for why that distinction is load-bearing.
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
