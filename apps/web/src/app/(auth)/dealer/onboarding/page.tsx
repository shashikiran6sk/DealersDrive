import type {
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
import { OnboardingWizard } from '@/features/auth/onboarding-wizard';
import { ApiError, apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: false };

export const metadata: Metadata = {
  title: 'Set up your dealership',
  robots: PRIVATE_ROBOTS,
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const session = await session_();

  if (session.dealer && !['DRAFT', 'PENDING_APPROVAL'].includes(session.dealer.status)) {
    redirect('/dealer');
  }

  const [documents, dealer, completeness, yardPhoto, phoneWidget] = await Promise.all([
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
  ]);

  const requested = Number((await searchParams).step ?? NaN);

  const floor = session.dealer?.status === 'PENDING_APPROVAL' ? 3 : 0;
  const step = Number.isFinite(requested)
    ? Math.min(3, Math.max(floor, requested))
    : landingStep(session, dealer, completeness);

  return (
    <AuthShell>
      <OnboardingWizard
        step={step as 0 | 1 | 2 | 3}
        session={session}
        documents={documents?.data ?? []}
        dealer={dealer}
        completeness={completeness}
        yardPhoto={yardPhoto}
        phoneWidget={phoneWidget}
      />
    </AuthShell>
  );
}

function landingStep(
  session: AuthSession,
  dealer: DealerProfile | null,
  completeness: CompletenessResponse | null,
): 0 | 1 | 2 | 3 {
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
