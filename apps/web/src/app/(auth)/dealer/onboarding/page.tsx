import type {
  AuthSession,
  CompletenessResponse,
  DealerDocumentsResponse,
  DealerProfile,
  YardPhotoDto,
} from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
import { OnboardingWizard } from '@/features/auth/onboarding-wizard';
import { ApiError, apiGet } from '@/lib/api';

/**
 * DESIGN-SPEC §3.10 — dealer onboarding.
 *
 * The screen a verified Google account lands on when it has no dealership yet,
 * and the screen a half-finished dealership returns to. Which of the four steps
 * it opens on is decided here, on the server, from the session — not from
 * anything the browser remembers.
 *
 * The email is never asked for. It arrived from Google, the API verified it,
 * and step 1 shows it as a read-only verified field.
 */
export const dynamic = 'force-dynamic';

/*
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline spreads `seoMetadata({ kind: 'private' })` from `lib/seo.ts`
 * here. That file is the whole indexing policy in one function and belongs to
 * **F095**; what it resolves to for a `private` route is the literal below.
 * The same substitution was made at `(auth)/dealer/login/page.tsx` in F018,
 * for the same reason — an onboarding screen carrying a person's name, phone
 * and business details must be `noindex` from the day it exists.
 */
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

  // A dealership that is DRAFT is still being set up, and one awaiting approval
  // still has a screen here — the "under review" panel that closes the wizard
  // (DESIGN-SPEC §3.10 step 4). Anything else belongs in the console.
  if (session.dealer && !['DRAFT', 'PENDING_APPROVAL'].includes(session.dealer.status)) {
    redirect('/dealer');
  }

  // All dealership-scoped, so they exist only once one does.
  //
  // `GET /v1/cities` was the fifth request here, fetched for a dropdown on
  // step 2. The city is typed now, so the screen no longer waits on reference
  // data to render a form the dealer fills in themselves.
  const [documents, dealer, completeness, yardPhoto] = await Promise.all([
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
  ]);

  const requested = Number((await searchParams).step ?? NaN);

  /**
   * Where the wizard opens, and how far back it goes.
   *
   * The floor used to be 2 once a dealership existed, on the reasoning that
   * steps 1 and 2 *create* it and so are behind you. That is true of the write
   * and false of the dealer: a name typed wrong on step 2 could not be
   * corrected without an admin, and step 3 had a Back button pointing at a step
   * the server would bounce them off. Steps 1 and 2 now amend as readily as
   * they create, so the only floor left is the real one — a submitted
   * dealership has nothing to edit while it is being reviewed.
   *
   * `landing` is separate from the floor, and stays where it was: a returning
   * dealer wants the step they had reached, not the one they finished weeks ago.
   */
  const floor = session.dealer?.status === 'PENDING_APPROVAL' ? 3 : 0;
  const landing = session.dealer?.status === 'PENDING_APPROVAL' ? 3 : session.dealer ? 2 : 0;
  const step = Number.isFinite(requested) ? Math.min(3, Math.max(floor, requested)) : landing;

  return (
    <AuthShell>
      <OnboardingWizard
        step={step as 0 | 1 | 2 | 3}
        session={session}
        documents={documents?.data ?? []}
        dealer={dealer}
        completeness={completeness}
        yardPhoto={yardPhoto}
      />
    </AuthShell>
  );
}

/** The session, or the sign-in screen. A 401 here is a redirect, not an error page. */
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
