import type { AuthProvidersResponse, PhoneOtpWidget } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthHeading, AuthShell } from '@/components/auth/auth-shell';
import { CustomerLogin, DealerLogin, LOGIN_TEXT, LoginTabs } from '@/features/auth/login';
import { apiGet } from '@/lib/api';
import { currentSession, destinationFor } from '@/lib/session';
import { one, safeReturnPath, type SearchParamsInput } from '@/lib/url';

export const dynamic = 'force-dynamic';

const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: false };

export const metadata: Metadata = {
  title: 'Login',
  robots: PRIVATE_ROBOTS,
};

const LOGIN_EYEBROW = 'Dealers-Drive';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const audience = one(params, 'as') === 'dealer' ? 'dealer' : 'customer';
  const requested = one(params, 'returnTo');
  const error = one(params, 'error') ?? null;

  if (audience === 'dealer') {
    const session = await currentSession();
    if (session) redirect(destinationFor(session));
  }

  const [providers, widget] = await Promise.all([
    apiGet<AuthProvidersResponse>('/v1/auth/providers', { revalidate: false }),
    signInWidget(),
  ]);

  const dealerReturnTo = requested ? safeReturnPath(requested, '/dealer') : null;
  const googleHref = dealerReturnTo
    ? `${providers.google.startUrl}?returnTo=${encodeURIComponent(dealerReturnTo)}`
    : providers.google.startUrl;

  return (
    <AuthShell eyebrow={LOGIN_EYEBROW}>
      <AuthHeading title={LOGIN_TEXT.title} />
      <LoginTabs
        initial={audience}
        customer={<CustomerLogin widget={widget} returnTo={safeReturnPath(requested, '/')} />}
        dealer={
          <DealerLogin
            widget={widget}
            google={{
              href: googleHref,
              enabled: providers.google.enabled,
              reason: providers.google.reason,
            }}
            returnTo={dealerReturnTo}
            error={error}
          />
        }
      />
    </AuthShell>
  );
}

async function signInWidget(): Promise<PhoneOtpWidget | null> {
  try {
    return await apiGet<PhoneOtpWidget>('/v1/auth/sign-in/phone/widget', { revalidate: false });
  } catch {
    return null;
  }
}
