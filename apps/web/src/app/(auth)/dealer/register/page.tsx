import type {
  AuthSession,
  AuthProvidersResponse,
  PhoneOtpWidget,
  ProgressiveState,
  DealerProfile,
  DealerDocumentsResponse,
  CompletenessResponse,
} from '@dealers-drive/contracts';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { ProgressiveRegistration } from '@/features/progressive/registration';
import { ProgressiveWorkspace } from '@/features/progressive/workspace';
import { apiGet, ApiError } from '@/lib/api';
import { seoMetadata } from '@/lib/seo';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Register your dealership', ...seoMetadata({ kind: 'private' }) };
export default async function RegistrationPage() {
  let session: AuthSession;
  try {
    session = await apiGet<AuthSession>('/v1/auth/me', { revalidate: false });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/dealer/login');
    throw error;
  }
  if (session.dealer) {
    const progressive = await apiGet<ProgressiveState | null>('/v1/dealer/progressive', {
      revalidate: false,
    });
    if (!progressive) redirect('/dealer/onboarding');
    const [dealer, documents, completeness] = await Promise.all([
      apiGet<DealerProfile>('/v1/dealer', { revalidate: false }),
      apiGet<DealerDocumentsResponse>('/v1/dealer/documents', { revalidate: false }),
      apiGet<CompletenessResponse>('/v1/dealer/completeness', { revalidate: false }),
    ]);
    return (
      <AuthShell>
        <ProgressiveWorkspace
          progressive={progressive}
          dealer={dealer}
          documents={documents.data}
          completeness={completeness}
        />
      </AuthShell>
    );
  }
  const [widget, providers] = await Promise.all([
    apiGet<PhoneOtpWidget>('/v1/auth/phone/widget', { revalidate: false }).catch(() => null),
    apiGet<AuthProvidersResponse>('/v1/auth/providers', { revalidate: false }),
  ]);
  return (
    <AuthShell>
      <ProgressiveRegistration
        session={session}
        widget={widget}
        googleLinkUrl={
          providers.google.enabled
            ? `${providers.google.linkStartUrl}?returnTo=${encodeURIComponent('/dealer/register')}`
            : null
        }
      />
    </AuthShell>
  );
}
