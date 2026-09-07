import type { DealerProfile } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
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

vi.mock('@/features/dealer/profile-actions', () => ({
  saveDealerProfileAction: (previous: unknown, formData: unknown) =>
    saveDealerProfileAction(previous as ProfileActions.ProfileFormState, formData as FormData),
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
  about: 'Family-run since 1998, and every car is inspected in-house before it is listed.',
  gstin: '33AABCS1429B1ZX',
  pan: 'AABCS1429B',
  contact: {
    fullName: 'Ramesh Kumar',
    roleTitle: 'Owner',
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
};

describe('what the form offers', () => {
  it('shows the dealership under its one name', () => {
    render(<DealerProfileForm dealer={DEALER} />);

    expect(screen.getByLabelText(/dealership name/i)).toHaveValue('Sri Lakshmi Motors Pvt Ltd');
    expect(screen.queryByLabelText(/trading name/i)).toBeNull();
  });

  /** D6, R2 and R6 — three text boxes and a link, not a dropdown over a table. */
  it('lets the dealer type their own city, district, state and Maps link', () => {
    render(<DealerProfileForm dealer={DEALER} />);

    for (const label of [/^city/i, /^district/i, /^state/i]) {
      expect(screen.getByLabelText(label)).toBeEnabled();
    }
    expect(screen.getByLabelText(/google maps location/i)).toHaveValue(
      'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
    );
  });

  /** R7 — raw, because raw is what the field accepts back. */
  it('offers the mobile as an editable raw number', () => {
    render(<DealerProfileForm dealer={DEALER} />);
    const mobile = screen.getByLabelText(/mobile/i);

    expect(mobile).toBeEnabled();
    expect(mobile).toHaveValue('9840012345');
  });

  it('shows the tax identifiers but does not let them be edited here', () => {
    render(<DealerProfileForm dealer={DEALER} />);

    expect(screen.getByLabelText(/gstin/i)).toBeDisabled();
    expect(screen.getByLabelText(/^pan/i)).toBeDisabled();
  });

  it('renders the services as one comma-separated line', () => {
    render(<DealerProfileForm dealer={DEALER} />);

    expect(screen.getByLabelText(/services/i)).toHaveValue('Hatchbacks, RC transfer');
  });

  /** A row that predates R2 and R6 renders empty boxes, not broken ones. */
  it('survives a dealership with nothing optional answered', () => {
    render(
      <DealerProfileForm
        dealer={{
          ...DEALER,
          tagline: null,
          about: null,
          gstin: null,
          pan: null,
          specialities: [],
          establishedYear: null,
          address: { ...DEALER.address, district: null, mapsUrl: null, mapKind: 'NONE' },
        }}
      />,
    );

    expect(screen.getByLabelText(/^district/i)).toHaveValue('');
    expect(screen.getByLabelText(/google maps location/i)).toHaveValue('');
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

  it('says a pin is only a pin, and how to replace it', () => {
    render(
      <DealerProfileForm
        dealer={{ ...DEALER, address: { ...DEALER.address, mapKind: 'POINT' } }}
      />,
    );

    expect(screen.getByText(/does not name your dealership/i)).toBeInTheDocument();
    // The diagnosis is useless without the remedy.
    expect(screen.getByText(/search Google Maps for your business/i)).toBeInTheDocument();
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

    await user.clear(screen.getByLabelText(/tagline/i));
    await user.type(screen.getByLabelText(/tagline/i), 'Only diesel SUVs');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(saveDealerProfileAction).toHaveBeenCalled();
    const formData = saveDealerProfileAction.mock.calls.at(-1)?.[1];
    expect(formData?.get('tagline')).toBe('Only diesel SUVs');
    expect(formData?.get('addressCity')).toBe('Vellore');
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
      fieldErrors: { addressMapsUrl: 'That does not look like a Google Maps link.' },
    });
    const user = userEvent.setup();
    render(<DealerProfileForm dealer={DEALER} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/does not look like a google maps link/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/google maps location/i)).toHaveAttribute('aria-invalid', 'true');
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
