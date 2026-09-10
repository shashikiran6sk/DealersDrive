import type { AdminProfileChange } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ProfileChangeReview } from '@/features/admin/profile-change-review';

import { adminActionStub } from '../../mocks/admin-actions';

/**
 * D3b (C062d) — the card a moderator decides a dealer's own words from
 * (**R34**).
 *
 * ## What it is guarding
 *
 * The tagline and the service list are the only free text a dealer writes that
 * a buyer reads. Everything else on their profile screen has been read-only
 * since R27; these two stayed editable because a dealership is entitled to
 * revise how it describes itself. That leaves exactly one route by which a
 * phone number can reach a public page without passing
 * `POST /v1/vehicles/:id/reveal-contact` — the one endpoint allowed to hand one
 * out, rate-limited twice over and logged as a lead. This card is where it gets
 * caught, and `PhoneNumberInTheTagline` is the story it exists for.
 *
 * Three things to check by eye:
 *
 *   · **Old and new, side by side, always.** The question is "is this *change*
 *     acceptable", not "is this sentence acceptable", and the two differ
 *     whenever the edit is a small correction to a line already approved. A
 *     card showing only the proposal makes the reviewer hold the old value in
 *     their head — and a reviewer doing that is one who approves a number
 *     appended to a sentence they half-remember.
 *   · **A field the edit does not touch says `unchanged`.** `ServicesOnly` and
 *     `TaglineOnly` are the two. An empty row under Services would read as *the
 *     dealer is clearing their services*, which is the opposite of what `[]`
 *     means here — and a moderator approving that reading approves something
 *     nobody asked for.
 *   · **Refuse needs a sentence before it works.** The dealer reads it verbatim
 *     on their own profile screen, and it is the only account they will ever
 *     get of why their line did not appear.
 *
 * Neither decision is behind a confirm step, and that is deliberate. Both are
 * reversible in the way that matters — a refused edit is resubmitted in a
 * minute, a wrongly published one is edited back — which is a different
 * category from `Reject dealership`, and dressing them alike would teach a
 * moderator to click through the one that does destroy something.
 *
 * The Server Actions are stubbed — `src/mocks/admin-actions.ts`, coupling C-4.
 */
const BASE: AdminProfileChange = {
  id: '9a1e4c22-0000-4000-8000-000000000009',
  dealerId: '3c8f2b10-2222-4000-8000-000000000002',
  dealerSlug: 'sri-lakshmi-motors',
  dealerName: 'Sri Lakshmi Motors',
  initials: 'SL',
  status: 'PENDING',
  statusLabel: 'Waiting for review',
  statusTone: 'warn',
  tagline: 'Only diesel SUVs now, every one with a full service history.',
  specialities: ['SUVs', 'Exchange', 'Bank loan tie-ups'],
  liveTagline: 'Hatchbacks under ₹6 lakh, every one inspected in-house.',
  liveSpecialities: ['Hatchbacks', 'RC transfer assistance'],
  submittedAt: '2026-09-09T09:00:00.000Z',
  submittedAtLabel: '09 Sep 2026',
  waitingLabel: '4 hours',
  decisionReason: null,
};

const change = (overrides: Partial<AdminProfileChange> = {}): AdminProfileChange => ({
  ...BASE,
  ...overrides,
});

const meta = {
  title: 'Admin/ProfileChangeReview',
  component: ProfileChangeReview,
  args: { change: BASE },
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    adminActionStub.result = { ok: true };
    adminActionStub.delayMs = 900;
    adminActionStub.calls.length = 0;
  },
} satisfies Meta<typeof ProfileChangeReview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Both fields changed — the fullest the card gets. */
export const Default: Story = {};

/**
 * **The story this card exists for.** A tagline with a mobile number in it.
 *
 * Nothing marks it: no highlight, no warning, no detection. That is honest — a
 * regex that flagged ten-digit strings would miss `nine eight four zero zero`
 * and would teach a moderator to trust the absence of a flag. The card's job is
 * to put the sentence in front of a person at a size they will read it at.
 */
export const PhoneNumberInTheTagline: Story = {
  args: {
    change: change({
      tagline: 'Best prices in Vellore — call 98400 12345 direct, no middleman!',
      specialities: [],
    }),
  },
};

/**
 * Services only. The tagline row reads `unchanged` and keeps the live value on
 * screen — it is what would survive the approval.
 */
export const ServicesOnly: Story = {
  args: { change: change({ tagline: null }) },
};

/** And the other way round. */
export const TaglineOnly: Story = {
  args: { change: change({ specialities: [] }) },
};

/**
 * A dealership that has never had a tagline — every row onboarded before R26
 * asked for one. `—` rather than a blank, so "not answered" reads as a state
 * rather than as a rendering fault.
 */
export const NothingLiveToCompareAgainst: Story = {
  args: { change: change({ liveTagline: null, liveSpecialities: [] }) },
};

/**
 * The refusal path, open. Press `Refuse…` on any story to reach it; this one
 * starts there so the disabled button is visible without a click.
 *
 * Type fewer than six characters and the button stays disabled — the client
 * half of the floor `ReasonInput` enforces server-side.
 */
export const Refusing: Story = {
  args: { change: change() },
  play: ({ canvasElement }) => {
    const refuse = [...canvasElement.querySelectorAll('button')].find((node) =>
      node.textContent?.startsWith('Refuse'),
    );
    refuse?.click();
  },
};

/**
 * A decision that lost a race — the other moderator got there first.
 *
 * The API answers 409 and the card says so rather than showing a tick. Two
 * moderators working the same queue is the ordinary case, not an edge one.
 */
export const AlreadyDecided: Story = {
  args: { change: change() },
  beforeEach: () => {
    adminActionStub.result = { ok: false, message: 'This edit has already been published.' };
    adminActionStub.delayMs = 400;
  },
};

/** The decision in flight, so the busy button and the frozen card are visible. */
export const Deciding: Story = {
  args: { change: change() },
  beforeEach: () => {
    adminActionStub.delayMs = 8000;
  },
};
