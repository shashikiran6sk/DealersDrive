import type {
  AuthSession,
  CompletenessResponse,
  DealerDocumentsResponse,
  DealerProfile,
  PublicConfig,
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
  const [config, documents, dealer, completeness, yardPhoto] = await Promise.all([
    /*
     * **R39.** What the browser needs to ask Firebase for an OTP, read on the
     * server and passed down as a prop.
     *
     * Not a `NEXT_PUBLIC_*` (rule 9): those are inlined at build time and would
     * force one image per environment. Cached for a minute rather than not at
     * all, because it is deployment wiring that changes at a deploy — every
     * dealer on step 1 re-fetching it would be a request per page view for an
     * answer that has not moved.
     *
     * A failure here is not a failure of the page. `null` renders the panel
     * that says verification is not configured, which is exactly what a local
     * `fake`-driver deployment should show.
     */
    apiGet<PublicConfig>('/v1/config/public', { revalidate: 60 }).catch(() => null),
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
   * Where it *opens* when no step is asked for is a separate question, and
   * `landingStep` below answers it.
   */
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
        firebase={config?.firebase ?? null}
      />
    </AuthShell>
  );
}

/**
 * Which step a dealer arriving with no `?step=` lands on.
 *
 * Three cases, and the third is the one that needed a rule.
 *
 *   · **No dealership yet** — step 1. There is nothing else it could be.
 *   · **Waiting for a decision** — step 4, the "we are reviewing this" panel.
 *     There is nothing to edit while somebody is looking at it.
 *   · **A draft.** Ordinarily step 3: a returning dealer wants the step they
 *     had reached, not the one they finished last week.
 *
 * An application a moderator **sent back** is a draft too, and landing it on
 * step 3 would be wrong — the dealer arrives to be told something needs
 * changing and is put on the screen after the one that usually holds it.
 * `statusReason` on a DRAFT dealership is the mark of that: nothing else sets
 * it, so it means "an admin looked at this and handed it back".
 *
 * Where it lands then depends on *what* was asked for, and the completeness
 * answer already knows. A rejected document leaves the Documents step
 * incomplete — the file was deleted with the rejection — so that is where the
 * work is. A request for changes to the business details leaves every step
 * complete, and the only screen that can be meant is the first one, where the
 * name, address and contact live.
 *
 * Deriving it from `completeness` rather than storing a step on the dealership
 * keeps one answer to "what is outstanding": the same one `POST
 * /v1/dealer/submit` refuses on.
 */
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
