import type {
  AuthProvidersResponse,
  AuthSession,
  CompletenessResponse,
  DealerDocumentsResponse,
  DealerProfile,
  PhoneOtpWidget,
  YardPhotoDto,
} from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
import { OnboardingWizard, type OnboardingStep } from '@/features/auth/onboarding-wizard';
import { ApiError, apiGet } from '@/lib/api';
import { getPublicConfig } from '@/lib/public-config';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const LINK_RETURN_TO = '/dealer/onboarding';

export const metadata: Metadata = {
  title: 'Set up your dealership',
  ...seoMetadata({ kind: 'private' }),
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>;
}) {
  const session = await session_();

  if (session.dealer && !['DRAFT', 'PENDING_APPROVAL'].includes(session.dealer.status)) {
    redirect('/dealer');
  }

  const [documents, dealer, completeness, yardPhoto, phoneWidget, googleLinkUrl, config] =
    await Promise.all([
      session.dealer
        ? apiGet<DealerDocumentsResponse>('/v1/dealer/documents', { revalidate: false })
        : Promise.resolve(null),
      session.dealer
        ? apiGet<DealerProfile>('/v1/dealer', { revalidate: false })
        : Promise.resolve(null),
      session.dealer
        ? apiGet<CompletenessResponse>('/v1/dealer/completeness', { revalidate: false })
        : Promise.resolve(null),
      session.dealer
        ? apiGet<YardPhotoDto>('/v1/dealer/yard-photo', { revalidate: false })
        : Promise.resolve(null),
      phoneWidgetOrNull(),
      session.identity ? Promise.resolve(null) : googleLinkUrlOrNull(),
      getPublicConfig(),
    ]);

  const params = await searchParams;
  const requested = Number(params.step ?? NaN);

  const floor = session.dealer?.status === 'PENDING_APPROVAL' ? 3 : 0;
  const step = Number.isFinite(requested)
    ? stepOf(Math.min(3, Math.max(floor, requested)))
    : landingStep(session, dealer, completeness);

  return (
    <AuthShell>
      <OnboardingWizard
        step={step}
        session={session}
        documents={documents?.data ?? []}
        dealer={dealer}
        completeness={completeness}
        yardPhoto={yardPhoto}
        phoneWidget={phoneWidget}
        googleLinkUrl={googleLinkUrl}
        linkError={params.error ?? null}
        whatsappOtp={config.whatsappOtpEnabled}
      />
    </AuthShell>
  );
}

function stepOf(value: number): OnboardingStep {
  if (value === 1) return 1;
  if (value === 2) return 2;
  if (value === 3) return 3;
  return 0;
}

function landingStep(
  session: AuthSession,
  dealer: DealerProfile | null,
  completeness: CompletenessResponse | null,
): OnboardingStep {
  if (session.dealer?.status === 'PENDING_APPROVAL') return 3;
  if (!session.dealer) return 0;

  const sentBack = dealer?.status === 'DRAFT' && Boolean(dealer.statusReason);
  if (!sentBack) return 2;

  const documents = completeness?.steps.find((step) => step.key === 'documents');
  return documents?.complete === false ? 2 : 0;
}

async function phoneWidgetOrNull(): Promise<PhoneOtpWidget | null> {
  try {
    return await apiGet<PhoneOtpWidget>('/v1/auth/phone/widget', { revalidate: false });
  } catch {
    return null;
  }
}

async function googleLinkUrlOrNull(): Promise<string | null> {
  try {
    const providers = await apiGet<AuthProvidersResponse>('/v1/auth/providers', {
      revalidate: false,
    });
    return providers.google.enabled
      ? `${providers.google.linkStartUrl}?returnTo=${encodeURIComponent(LINK_RETURN_TO)}`
      : null;
  } catch {
    return null;
  }
}

async function session_(): Promise<AuthSession> {
  try {
    return await apiGet<AuthSession>('/v1/auth/me', { revalidate: false });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect('/dealer/login?error=session_expired');
    }
    throw error;
  }
}
