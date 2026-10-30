import { LegalGate } from '@/features/legal/legal-gate';
import { legalGateEnabled, legalStatus } from '@/lib/legal';
import type { AuthProvidersResponse, PhoneOtpWidget } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import Link from 'next/link';

import { AuthHeading, AuthShell } from '@/components/auth/auth-shell';
import { EntryShell } from '@/components/auth/entry-shell';
import { CustomerLogin, DealerLogin, LOGIN_TEXT, LoginTabs } from '@/features/auth/login';
import { apiGet } from '@/lib/api';
import { currentSession, destinationFor } from '@/lib/session';
import { one, safeReturnPath, type SearchParamsInput } from '@/lib/url';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: 'Login', ...seoMetadata({ kind: 'noindex' }) };
}

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

  if (audience === 'customer') {
    const status = await legalStatus('CUSTOMER');
    if (status?.enabled && !status.accepted) {
      const returnTo = safeReturnPath(requested, '/');
      return (
        <EntryShell>
          <AuthShell eyebrow={LOGIN_EYEBROW}>
            <LegalGate scope="CUSTOMER" returnTo={returnTo} />
          </AuthShell>
        </EntryShell>
      );
    }
    if (status?.enabled && status.accepted && requested) {
      redirect(safeReturnPath(requested, '/'));
    }
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
    <EntryShell>
      <AuthShell eyebrow={LOGIN_EYEBROW}>
        <AuthHeading title={LOGIN_TEXT.title} visuallyHidden />
        <LoginTabs
          initial={audience}
          customer={
            <CustomerLogin
              legalEnabled={legalGateEnabled()}
              widget={widget}
              returnTo={safeReturnPath(requested, '/')}
            />
          }
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
          footer={
            <Link
              href={LOGIN_TEXT.troubleHref}
              className="mx-auto mt-[22px] flex min-h-[40px] w-fit items-center text-[13px] font-bold ink-muted underline underline-offset-[3px] hover:text-(--color-ink)"
            >
              {LOGIN_TEXT.trouble}
            </Link>
          }
          dealerFooter={
            <Link
              href={LOGIN_TEXT.adminLoginHref}
              className="mx-auto flex min-h-[40px] w-fit items-center text-[12px] font-semibold ink-subtle underline-offset-[3px] hover:text-(--color-ink) hover:underline focus-visible:underline"
            >
              {LOGIN_TEXT.adminLogin}
            </Link>
          }
        />
      </AuthShell>
    </EntryShell>
  );
}

async function signInWidget(): Promise<PhoneOtpWidget | null> {
  try {
    return await apiGet<PhoneOtpWidget>('/v1/auth/sign-in/phone/widget', { revalidate: false });
  } catch {
    return null;
  }
}
