import type { AdminListingDetail } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AdminListingPage from '@/app/(admin)/admin/listings/[id]/page';
import { setListingCheckAction, setPhotographyAction } from '@/features/admin/listing-actions';
import { ListingReview } from '@/features/admin/listing-review';
import type * as ApiModule from '@/lib/api';

import { revalidations } from '../../../setup.js';

const apiGetParsed = vi.fn();
const apiSend = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown,
    apiSend: (...args: unknown[]) => apiSend(...args) as unknown,
  };
});

const ID = '11111111-1111-4111-8111-111111111111';

function reviewDetail(overrides: Partial<AdminListingDetail> = {}): AdminListingDetail {
  return {
    listing: {
      id: ID,
      vehicleId: '22222222-2222-4222-8222-222222222222',
      title: '2023 Hyundai Creta SX(O)',
      registrationDisplay: 'KA 01 AB 1234',
      summary: 'Petrol · Automatic · 22,400 km',
      priceLabel: '₹14,50,000',
      status: 'PENDING_REVIEW',
      statusLabel: 'Pending review',
      statusTone: 'warn',
      dealer: {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Sri Lakshmi Motors',
        slug: 'sri',
      },
      location: 'Katpadi, Vellore',
      submittedAt: '2026-09-26T09:00:00.000Z',
      submittedLabel: '26 Sep 2026',
      waitingLabel: '3 hours ago',
      resubmission: true,
      photography: { status: 'NOT_STARTED', label: 'Not photographed', tone: 'neutral' },
      reason: null,
      submissionCount: 2,
      publishedAt: null,
    },
    dealer: {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Sri Lakshmi Motors',
      slug: 'sri',
      status: 'ACTIVE',
      statusLabel: 'Active',
      statusTone: 'ok',
      location: 'Katpadi, Vellore',
      phoneDisplay: '+91 98400 12345',
    },
    sections: [
      {
        key: 'basics',
        title: 'Vehicle basics',
        rows: [
          { label: 'Make', value: 'Hyundai' },
          { label: 'Variant', value: null },
        ],
      },
    ],
    description: 'Single owner.',
    issues: [],
    photography: {
      status: 'SCHEDULED',
      label: 'Shoot scheduled',
      tone: 'warn',
      note: 'Tuesday 11am at the yard',
      updatedAt: '2026-09-26T09:30:00.000Z',
      canUpdate: true,
    },
    checks: [
      {
        key: 'REGISTRATION',
        label: 'Registration checked',
        hint: 'Plate matches.',
        checked: true,
        checkedAt: '2026-09-26T10:00:00.000Z',
      },
      {
        key: 'ODOMETER',
        label: 'Odometer checked',
        hint: 'Reading matches.',
        checked: false,
        checkedAt: null,
      },
    ],
    history: [
      {
        action: 'listing.changes_requested',
        label: 'Changes requested',
        actor: 'Dealers-Drive',
        reason: 'Wrong variant.',
        at: '2026-09-25T00:00:00.000Z',
        atLabel: '25 Sep 2026',
      },
    ],
    actions: { canVerify: true, canRequestChanges: true, canReject: true, canApprove: false },
    ...overrides,
  };
}

afterEach(() => {
  apiSend.mockReset();
});

describe('the review screen', () => {
  it('shows the dealership, each section, the description and the history with its reason', () => {
    render(<ListingReview detail={reviewDetail()} />);

    expect(
      screen.getByRole('heading', { level: 1, name: '2023 Hyundai Creta SX(O)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Submission 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open dealership' })).toHaveAttribute(
      'href',
      '/admin/dealers/33333333-3333-4333-8333-333333333333',
    );
    const basics = within(screen.getByRole('region', { name: 'Vehicle basics' }));
    expect(basics.getByText('Hyundai')).toBeInTheDocument();
    expect(basics.getByText('Not entered')).toBeInTheDocument();
    expect(screen.getByText('Single owner.')).toBeInTheDocument();
    expect(screen.getByText(/Wrong variant/)).toBeInTheDocument();
  });

  it('says photographs have not been added yet (R45)', () => {
    render(<ListingReview detail={reviewDetail()} />);
    expect(screen.getByText(/processed images are added here/)).toBeInTheDocument();
  });

  it('shows the photography status and lets a moderator change it, with the internal note', () => {
    render(<ListingReview detail={reviewDetail()} />);
    const panel = within(screen.getByRole('region', { name: 'Photography and images' }));
    expect(panel.getByText('Shoot scheduled', { selector: 'span' })).toBeInTheDocument();
    expect(panel.getByLabelText('Photography')).toHaveValue('SCHEDULED');
    expect(panel.getByLabelText(/Internal note/)).toHaveValue('Tuesday 11am at the yard');
    expect(panel.getByRole('button', { name: 'Save photography status' })).toBeInTheDocument();
  });

  it('shows photography read-only once the listing is out of review', () => {
    const detail = reviewDetail();
    render(
      <ListingReview
        detail={{ ...detail, photography: { ...detail.photography, canUpdate: false } }}
      />,
    );
    const panel = within(screen.getByRole('region', { name: 'Photography and images' }));
    expect(panel.queryByLabelText('Photography')).not.toBeInTheDocument();
    expect(panel.getByText('Tuesday 11am at the yard')).toBeInTheDocument();
  });

  it('offers to tick what is unticked and undo what is ticked, and counts them', () => {
    render(<ListingReview detail={reviewDetail()} />);

    const checklist = within(screen.getByRole('region', { name: 'Verification' }));
    expect(checklist.getByText('1/2')).toBeInTheDocument();
    expect(checklist.getByRole('button', { name: 'Undo: Registration checked' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      checklist.getByRole('button', { name: 'Mark checked: Odometer checked' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('offers Request changes and Reject while the listing is in review, and no approve yet', () => {
    render(<ListingReview detail={reviewDetail()} />);
    const panel = within(screen.getByRole('region', { name: 'Moderation' }));
    expect(panel.getByRole('button', { name: 'Request changes' })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });

  it('shows the checklist read-only once the listing is out of review', () => {
    render(
      <ListingReview
        detail={reviewDetail({
          actions: {
            canVerify: false,
            canRequestChanges: false,
            canReject: false,
            canApprove: false,
          },
        })}
      />,
    );
    expect(screen.queryByRole('button', { name: /Mark checked|Undo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Moderation' })).not.toBeInTheDocument();
  });

  it('lists what is still missing', () => {
    render(
      <ListingReview
        detail={reviewDetail({ issues: [{ field: 'color', message: 'Colour is required.' }] })}
      />,
    );
    expect(screen.getByText('Colour is required.')).toBeInTheDocument();
  });
});

describe('/admin/listings/[id]', () => {
  it('reads the listing uncached and renders it', async () => {
    apiGetParsed.mockResolvedValue(reviewDetail());
    render(await AdminListingPage({ params: Promise.resolve({ id: ID }) }));
    expect(apiGetParsed).toHaveBeenCalledWith(expect.anything(), `/v1/admin/listings/${ID}`, {
      revalidate: false,
    });
  });

  it('answers an unknown listing with the 404 page', async () => {
    const { ApiError } = await import('@/lib/api');
    apiGetParsed.mockRejectedValue(
      new ApiError({ type: 'x', title: 'Not found', status: 404, code: 'LISTING_NOT_FOUND' }),
    );
    await expect(AdminListingPage({ params: Promise.resolve({ id: ID }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });
});

describe('setListingCheckAction', () => {
  function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  }

  it('puts the check and refreshes the review screen', async () => {
    apiSend.mockResolvedValue({});
    await setListingCheckAction(form({ listingId: ID, key: 'ODOMETER', checked: 'true' }));

    expect(apiSend).toHaveBeenCalledWith('PUT', `/v1/admin/listings/${ID}/checks/ODOMETER`, {
      checked: true,
    });
    expect(revalidations.paths).toContain(`/admin/listings/${ID}`);
  });

  it('ignores a form naming an unknown check', async () => {
    await setListingCheckAction(form({ listingId: ID, key: 'PAINT', checked: 'true' }));
    expect(apiSend).not.toHaveBeenCalled();
  });

  it('refreshes after a refusal, and fails loudly if the API is unreachable', async () => {
    const { ApiError } = await import('@/lib/api');
    apiSend.mockRejectedValueOnce(
      new ApiError({ type: 'x', title: 'Conflict', status: 409, code: 'LISTING_NOT_REVIEWABLE' }),
    );
    await setListingCheckAction(form({ listingId: ID, key: 'YEAR', checked: 'false' }));

    apiSend.mockRejectedValueOnce(new Error('down'));
    await expect(
      setListingCheckAction(form({ listingId: ID, key: 'YEAR', checked: 'true' })),
    ).rejects.toThrow(/unavailable/);
  });
});

describe('setPhotographyAction', () => {
  function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  }

  it('puts the status with a trimmed note and refreshes the review screen', async () => {
    apiSend.mockResolvedValue({});
    await setPhotographyAction(
      form({ listingId: ID, status: 'READY', note: '  shot on Tuesday ' }),
    );

    expect(apiSend).toHaveBeenCalledWith('PUT', `/v1/admin/listings/${ID}/photography`, {
      status: 'READY',
      note: 'shot on Tuesday',
    });
    expect(revalidations.paths).toContain(`/admin/listings/${ID}`);
  });

  it('clears the note when it is left empty', async () => {
    apiSend.mockResolvedValue({});
    await setPhotographyAction(form({ listingId: ID, status: 'SCHEDULED', note: '   ' }));
    expect(apiSend).toHaveBeenCalledWith('PUT', `/v1/admin/listings/${ID}/photography`, {
      status: 'SCHEDULED',
      note: null,
    });
  });

  it('ignores a form naming an unknown status', async () => {
    await setPhotographyAction(form({ listingId: ID, status: 'UPLOADED' }));
    expect(apiSend).not.toHaveBeenCalled();
  });

  it('refreshes after a refusal, and fails loudly if the API is unreachable', async () => {
    const { ApiError } = await import('@/lib/api');
    apiSend.mockRejectedValueOnce(
      new ApiError({ type: 'x', title: 'Conflict', status: 409, code: 'PHOTOGRAPHY_CLOSED' }),
    );
    await setPhotographyAction(form({ listingId: ID, status: 'READY' }));
    expect(revalidations.paths).toContain(`/admin/listings/${ID}`);

    apiSend.mockRejectedValueOnce(new Error('down'));
    await expect(setPhotographyAction(form({ listingId: ID, status: 'READY' }))).rejects.toThrow(
      /unavailable/,
    );
  });
});
