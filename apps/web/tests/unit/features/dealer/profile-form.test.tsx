import type { DealerProfile } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type * as ProfileActions from '@/features/dealer/profile-actions';
import { DealerProfileForm } from '@/features/dealer/profile-form';

/**
 * The dealership's own record (C1/C2).
 *
 * What is asserted here is mostly what the form **refuses to offer**, because
 * that is the part that carries a rule rather than a layout:
 *
 *   · no `brandName` box — it is the server-written mirror of `legalName`, and
 *     two boxes able to disagree is what its absence prevents;
 *   · GSTIN and PAN present but disabled — verified against a document, and
 *     correctable only on the admin review screen, with the document in hand;
 *   · city, district, state and the Maps link *are* editable (D6, R2, R6),
 *     which is the divergence from the baseline most likely to be undone by
 *     somebody porting the old form back over this one.
 *
 * Nothing here pins spacing, headings or the order of the sections. A test that
 * fails when a card is re-titled is a tax, not a check.
 */
const saveDealerProfileAction = vi.fn(
  (
    _previous: ProfileActions.ProfileFormState,
    _formData: FormData,
  ): Promise<ProfileActions.ProfileFormState> =>
    Promise.resolve({ status: 'saved', fieldErrors: {} }),
);

/** R34's Cancel. Resolves to `null` on success, or a message. */
const withdrawProfileChangeAction = vi.fn((): Promise<string | null> => Promise.resolve(null));

vi.mock('@/features/dealer/profile-actions', () => ({
  saveDealerProfileAction: (previous: unknown, formData: unknown) =>
    saveDealerProfileAction(previous as ProfileActions.ProfileFormState, formData as FormData),
  withdrawProfileChangeAction: () => withdrawProfileChangeAction(),
}));

const DEALER: DealerProfile = {
  id: '3c8f2b10-2222-4000-8000-000000000002',
  slug: 'sri-lakshmi-motors',
  status: 'ACTIVE',
  statusLabel: 'Active',
  statusReason: null,
  brandName: 'Sri Lakshmi Motors',
  legalName: 'Sri Lakshmi Motors Pvt Ltd',
  tagline: 'Hatchbacks under ₹6 lakh',
  gstin: '33AABCS1429B1ZX',
  pan: 'AABCS1429B',
  contact: {
    fullName: 'Ramesh Kumar',
    phone: '9840012345',
    phoneDisplay: '+91 98400 12345',
    email: 'owner@sri-lakshmi-motors.in',
    landline: '0416 224 8890',
  },
  address: {
    line: '12 Katpadi Road',
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
    pincode: '632001',
    mapsUrl: 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
    mapKind: 'PLACE',
  },
  specialities: ['Hatchbacks', 'RC transfer'],
  workingHours: { mon_sat: '09:30-20:00', sun: null },
  establishedYear: 1998,
  logoMediaId: null,
  coverMediaId: null,
  creditBalance: 39,
  creditsHeld: 2,
  activeListings: 7,
  approvedAt: '2026-01-14T06:12:00.000Z',
  createdAt: '2025-12-01T09:00:00.000Z',
  /** R34. Nothing waiting on a moderator is the ordinary state. */
  profileChange: null,
};

describe('what the form offers', () => {
  it('shows the dealership under its one name', () => {
    render(<DealerProfileForm dealer={DEALER} />);

    expect(screen.getByLabelText(/dealership name/i)).toHaveValue('Sri Lakshmi Motors Pvt Ltd');
    expect(screen.queryByLabelText(/trading name/i)).toBeNull();
  });

  /**
   * **R27 — the rule this screen now exists to enforce.**
   *
   * Everything the platform verified is shown and none of it is editable: the
   * registered name, the whole address including the map link, and the two
   * ways a buyer reaches the business. Asserted by label rather than by count,
   * so a box added to the wrong section fails here rather than shipping.
   */
  it.each([
    ['dealership name', /dealership name/i],
    ['contact name', /contact name/i],
    ['email', /^email/i],
    ['mobile', /^mobile/i],
    ['landline', /^landline/i],
    ['street address', /street address/i],
    ['city', /^city/i],
    ['district', /^district/i],
    ['state', /^state/i],
    ['pincode', /^pincode/i],
    ['Maps link', /google maps location/i],
    ['GSTIN', /gstin/i],
    ['PAN', /^pan/i],
  ])('shows %s but does not let the dealer edit it', (_label, pattern) => {
    render(<DealerProfileForm dealer={DEALER} />);

    expect(screen.getByLabelText(pattern)).toBeDisabled();
  });

  /**
   * The half of the lock the browser enforces, and the one that matters most:
   * a control with no `name` has nothing to be submitted under, so a locked
   * value cannot reach the action even if `disabled` were lifted by a
   * stylesheet or a devtools poke.
   */
  it('gives the locked boxes no name to be submitted under', () => {
    const { container } = render(<DealerProfileForm dealer={DEALER} />);

    expect(
      [...container.querySelectorAll('input[name]')].map((input) => input.getAttribute('name')),
    ).toEqual(['establishedYear', 'tagline', 'specialities']);
  });

  /** The three that are still the dealer's own. */
  it.each([/established/i, /one line about your dealership/i, /services you offer/i])(
    'leaves %s editable',
    (pattern) => {
      render(<DealerProfileForm dealer={DEALER} />);

      expect(screen.getByLabelText(pattern)).toBeEnabled();
    },
  );

  /**
   * R27 reverses R7, and the mobile is shown formatted now rather than raw.
   * Raw was what the box *accepted back*; there is no box to accept anything,
   * so the dealer gets the readable form.
   */
  it('shows the mobile as a buyer would read it', () => {
    render(<DealerProfileForm dealer={DEALER} />);

    expect(screen.getByLabelText(/^mobile/i)).toHaveValue(DEALER.contact.phoneDisplay);
  });

  /**
   * Why, said once per section. A control somebody cannot use and is not told
   * why about reads as a broken page rather than as a locked one.
   */
  it('says why the locked sections are locked', () => {
    render(<DealerProfileForm dealer={DEALER} />);

    expect(screen.getByText(/contact support to change any of them/i)).toBeInTheDocument();
    expect(screen.getByText(/closes this account and opens a new one/i)).toBeInTheDocument();
  });

  it('shows the tax identifiers but does not let them be edited here', () => {
    render(<DealerProfileForm dealer={DEALER} />);

    expect(screen.getByLabelText(/gstin/i)).toBeDisabled();
    expect(screen.getByLabelText(/^pan/i)).toBeDisabled();
  });

  /**
   * **R37.** The services are chips now, and the box beside them is a draft
   * rather than the value — so what the dealer reads back is the list, not a
   * serialisation of it. The hidden input is what the browser submits, and its
   * format is unchanged: `servicesOf()` on the far side never learned about
   * any of this.
   */
  it('renders each service as its own chip, and submits them as one line', () => {
    const { container } = render(<DealerProfileForm dealer={DEALER} />);

    const chips = within(screen.getByRole('group', { name: /services added/i }));
    expect(chips.getByText('Hatchbacks')).toBeInTheDocument();
    expect(chips.getByText('RC transfer')).toBeInTheDocument();

    expect(screen.getByLabelText(/services you offer/i)).toHaveValue('');
    expect(container.querySelector('input[name="specialities"]')).toHaveValue(
      'Hatchbacks, RC transfer',
    );
  });

  /** Each chip carries its own way out, named after the service it removes. */
  it('offers a remove control per service', async () => {
    const user = userEvent.setup();
    render(<DealerProfileForm dealer={DEALER} />);

    await user.click(screen.getByRole('button', { name: 'Remove Hatchbacks' }));

    const chips = within(screen.getByRole('group', { name: /services added/i }));
    expect(chips.queryByText('Hatchbacks')).toBeNull();
    expect(chips.getByText('RC transfer')).toBeInTheDocument();
  });

  /** A row that predates R2 and R6 renders empty boxes, not broken ones. */
  it('survives a dealership with nothing optional answered', () => {
    render(
      <DealerProfileForm
        dealer={{
          ...DEALER,
          tagline: null,
          gstin: null,
          pan: null,
          specialities: [],
          establishedYear: null,
          address: { ...DEALER.address, district: null, mapsUrl: null, mapKind: 'NONE' },
        }}
      />,
    );

    // An em dash, not an empty box: a blank control under a label reads as
    // something you have not filled in yet, and these cannot be filled in.
    expect(screen.getByLabelText(/^district/i)).toHaveValue('—');
    expect(screen.getByLabelText(/google maps location/i)).toHaveValue('—');
  });
});

/**
 * R20 — what the saved Maps link is actually drawing, in words.
 *
 * A dealer pastes a URL and never sees the map it produces: the map is on their
 * public page, and the two kinds of link look identical in the box. The `POINT`
 * case is the one this exists for, and it has to carry the fix rather than only
 * the diagnosis.
 */
describe('the note under the Maps link', () => {
  it('confirms a link that names the dealership', () => {
    render(<DealerProfileForm dealer={DEALER} />);

    expect(screen.getByText(/shows your Google listing/i)).toBeInTheDocument();
  });

  it('says a pin is only a pin, and where the remedy is now', () => {
    render(
      <DealerProfileForm
        dealer={{ ...DEALER, address: { ...DEALER.address, mapKind: 'POINT' } }}
      />,
    );

    expect(screen.getByText(/does not name your dealership/i)).toBeInTheDocument();
    /*
     * The diagnosis is useless without a remedy, and R27 changed what the
     * remedy is: the link is read-only, so "share your business again" is
     * advice the dealer cannot act on.
     */
    expect(screen.getByText(/changed to your business card/i)).toBeInTheDocument();
    expect(screen.queryByText(/search Google Maps for your business/i)).toBeNull();
  });

  it('says when no location could be read at all', () => {
    render(
      <DealerProfileForm dealer={{ ...DEALER, address: { ...DEALER.address, mapKind: 'NONE' } }} />,
    );

    expect(screen.getByText(/could not read a location/i)).toBeInTheDocument();
  });

  /**
   * A dealer who has not answered yet is told how to answer, by the
   * instructions that were always there. A second line saying an empty box is
   * empty is noise.
   */
  it('says nothing at all when there is no link yet', () => {
    render(
      <DealerProfileForm
        dealer={{ ...DEALER, address: { ...DEALER.address, mapsUrl: null, mapKind: 'NONE' } }}
      />,
    );

    expect(screen.queryByText(/could not read a location/i)).toBeNull();
    expect(screen.queryByText(/shows your Google listing/i)).toBeNull();
  });
});

describe('what the form does with an answer', () => {
  it('submits to the action, carrying the boxes under their own names', async () => {
    const user = userEvent.setup();
    render(<DealerProfileForm dealer={DEALER} />);

    await user.clear(screen.getByLabelText(/one line about your dealership/i));
    await user.type(screen.getByLabelText(/one line about your dealership/i), 'Only diesel SUVs');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(saveDealerProfileAction).toHaveBeenCalled();
    const formData = saveDealerProfileAction.mock.calls.at(-1)?.[1];
    expect(formData?.get('tagline')).toBe('Only diesel SUVs');
    expect(formData?.get('specialities')).toBe('Hatchbacks, RC transfer');
    // R27 — the locked boxes carry no name, so the browser sends nothing for
    // them. This is the lock observed from the far side of the submit.
    expect(formData?.get('addressCity')).toBeNull();
    expect(formData?.get('legalName')).toBeNull();
    expect(formData?.get('contactPhone')).toBeNull();
    // Rule 1 again, from the other side: nothing identifies the dealership.
    expect(formData?.get('dealerId')).toBeNull();
  });

  it('says so when the save succeeded', async () => {
    const user = userEvent.setup();
    render(<DealerProfileForm dealer={DEALER} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/your profile has been saved/i)).toBeInTheDocument();
  });

  it('puts a field refusal under the box it names', async () => {
    saveDealerProfileAction.mockResolvedValueOnce({
      status: 'error',
      fieldErrors: { tagline: 'One line buyers will read under your name.' },
    });
    const user = userEvent.setup();
    render(<DealerProfileForm dealer={DEALER} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/one line buyers will read/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/one line about your dealership/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('falls back to a banner when nothing was named', async () => {
    saveDealerProfileAction.mockResolvedValueOnce({
      status: 'error',
      fieldErrors: {},
      message: 'Your dealership is suspended.',
    });
    const user = userEvent.setup();
    render(<DealerProfileForm dealer={DEALER} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/your dealership is suspended/i)).toBeInTheDocument();
  });
});

/**
 * R34 — the two sentences on this form go to a moderator, and the screen has to
 * say so.
 *
 * The failure this guards against is not cosmetic. A dealer presses Save, the
 * page reloads, the tagline box shows the line they typed — and their public
 * page shows the old one. With nothing on the screen explaining that, the
 * honest state of the product is invisible, and a dealer who cannot see their
 * change concludes the save failed and does it again.
 */
const PENDING: DealerProfile['profileChange'] = {
  id: '9a1e4c22-0000-4000-8000-000000000009',
  status: 'PENDING',
  statusLabel: 'Waiting for review',
  tagline: 'Only diesel SUVs, every one with a full service history.',
  specialities: ['SUVs', 'Exchange'],
  submittedAtLabel: '09 Sep 2026',
  reviewedAtLabel: null,
  decisionReason: null,
};

describe('an edit waiting for review', () => {
  it('says what is waiting and what buyers are still seeing', () => {
    render(<DealerProfileForm dealer={{ ...DEALER, profileChange: PENDING }} />);

    expect(screen.getByText(/waiting for a quick check/i)).toBeInTheDocument();
    expect(screen.getByText(/“Only diesel SUVs/)).toBeInTheDocument();
    /*
     * Scoped to the panel. Since **R37** the locked box below renders the same
     * proposed services as chips, so a bare `getByText('SUVs')` is ambiguous —
     * and the claim being made here is about the panel, not about the box.
     */
    const proposed = screen.getByText('Your new services').closest('div');
    expect(within(proposed as HTMLElement).getByText('SUVs')).toBeInTheDocument();
    // The live line is still on the screen, in the box, so the dealer can see
    // both. What buyers see is the point of the whole panel.
    expect(screen.getByText(/buyers see the current version/i)).toBeInTheDocument();
  });

  /**
   * The two boxes are **shut** while a change waits, and hold the proposed
   * text.
   *
   * The dealer has already said what they want; the question in front of them
   * is no longer "what should this say" but "do I stand by this". Leaving the
   * boxes live would offer an edit the API refuses with a 409 — the worst of
   * the three options, because the dealer types a sentence and is then told
   * they could not have.
   */
  it('locks the two boxes and shows the proposed text in them', () => {
    render(<DealerProfileForm dealer={{ ...DEALER, profileChange: PENDING }} />);

    const tagline = screen.getByLabelText(/one line about your dealership/i);
    const services = screen.getByLabelText(/services you offer/i);

    expect(tagline).toHaveValue('Only diesel SUVs, every one with a full service history.');
    expect(tagline).toBeDisabled();

    // R37 — the draft box is shut, and the proposal is the chips beside it.
    expect(services).toBeDisabled();
    const chips = within(screen.getByRole('group', { name: /services added/i }));
    expect(chips.getByText('SUVs')).toBeInTheDocument();
    expect(chips.getByText('Exchange')).toBeInTheDocument();
    // A locked chip offers no way out — withdrawing the whole change is the way.
    expect(screen.queryByRole('button', { name: /^Remove /i })).toBeNull();
  });

  /**
   * `disabled` **and** no `name`, which is the R27 shape and load-bearing for
   * the same reason: a disabled control is not submitted, and one with no name
   * has nothing to be submitted under. So a locked box cannot reach the action
   * even by accident, and a save in this state carries the established year
   * and nothing else.
   */
  it('sends nothing for a locked box', () => {
    const { container } = render(
      <DealerProfileForm dealer={{ ...DEALER, profileChange: PENDING }} />,
    );

    expect(container.querySelector('[name="tagline"]')).toBeNull();
    expect(container.querySelector('[name="specialities"]')).toBeNull();
    // The year is untouched by any of this — it never needed review.
    expect(container.querySelector('[name="establishedYear"]')).not.toBeNull();
  });

  /** And they are open again, on the live values, when nothing is waiting. */
  it('leaves the boxes open when nothing is waiting', () => {
    const { container } = render(<DealerProfileForm dealer={DEALER} />);

    expect(screen.getByLabelText(/one line about your dealership/i)).toBeEnabled();
    expect(screen.getByLabelText(/services you offer/i)).toBeEnabled();
    expect(container.querySelector('[name="tagline"]')).not.toBeNull();
  });

  /**
   * Cancel is the only way out, and it is a button rather than something to be
   * inferred from what the dealer types.
   */
  it('withdraws the change when the dealer cancels it', async () => {
    const user = userEvent.setup();
    render(<DealerProfileForm dealer={{ ...DEALER, profileChange: PENDING }} />);

    await user.click(screen.getByRole('button', { name: /cancel this change/i }));

    expect(withdrawProfileChangeAction).toHaveBeenCalledTimes(1);
  });

  /** It says what cancelling does, because the boxes unlocking is the point. */
  it('says what cancelling will do', () => {
    render(<DealerProfileForm dealer={{ ...DEALER, profileChange: PENDING }} />);

    expect(screen.getByText(/previous wording comes back/i)).toBeInTheDocument();
  });

  it('surfaces a failed cancel rather than looking like it worked', async () => {
    const user = userEvent.setup();
    withdrawProfileChangeAction.mockResolvedValueOnce('We could not cancel that change.');
    render(<DealerProfileForm dealer={{ ...DEALER, profileChange: PENDING }} />);

    await user.click(screen.getByRole('button', { name: /cancel this change/i }));

    expect(await screen.findByText('We could not cancel that change.')).toBeInTheDocument();
  });

  /**
   * A refusal is the only thing on this screen a dealer must read, and it is
   * the only account they will ever get of why their line did not appear.
   */
  it('shows the moderator’s reason, and says the page is unchanged', () => {
    render(
      <DealerProfileForm
        dealer={{
          ...DEALER,
          profileChange: {
            ...PENDING,
            status: 'REJECTED',
            statusLabel: 'Not approved',
            reviewedAtLabel: '09 Sep 2026',
            decisionReason: 'The tagline ends with a mobile number. Please remove it.',
          },
        }}
      />,
    );

    expect(
      screen.getByText('The tagline ends with a mobile number. Please remove it.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/public page is unchanged/i)).toBeInTheDocument();
  });

  /**
   * A refused line is *not* put back in the box. The moderator's reason is
   * above it and the point is to write something different — restoring the
   * refused text invites the dealer to press Save again unchanged.
   */
  it('does not lock the boxes after a refusal — the point is to rewrite it', () => {
    render(
      <DealerProfileForm
        dealer={{
          ...DEALER,
          profileChange: { ...PENDING, status: 'REJECTED', decisionReason: 'No numbers, please.' },
        }}
      />,
    );

    expect(screen.getByLabelText(/one line about your dealership/i)).toBeEnabled();
    expect(screen.queryByRole('button', { name: /cancel this change/i })).toBeNull();
  });

  it('does not refill the box with the words that were refused', () => {
    render(
      <DealerProfileForm
        dealer={{
          ...DEALER,
          profileChange: { ...PENDING, status: 'REJECTED', decisionReason: 'No numbers, please.' },
        }}
      />,
    );

    expect(screen.getByLabelText(/one line about your dealership/i)).toHaveValue(DEALER.tagline);
  });

  /** Nothing waiting, nothing said. */
  it('says nothing at all when there is no edit in flight', () => {
    render(<DealerProfileForm dealer={DEALER} />);

    expect(screen.queryByText(/waiting for a quick check/i)).toBeNull();
    expect(screen.queryByText(/not published/i)).toBeNull();
  });

  /**
   * And the save banner tells the truth about what just happened. "Your profile
   * has been saved" alone would be read as "your page has changed" by a dealer
   * who then looks at their page and finds it has not.
   */
  it('says what a save actually did when something is now waiting', async () => {
    const user = userEvent.setup();
    render(<DealerProfileForm dealer={{ ...DEALER, profileChange: PENDING }} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/go to us for a quick check/i)).toBeInTheDocument();
  });
});
