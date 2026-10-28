import type { AdminListingDetail } from '@dealers-drive/contracts';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AdminListingPage from '@/app/(admin)/admin/listings/[id]/page';
import {
  updateListingVehicleAction,
  changeListingAvailabilityAction,
  approveListingAction,
  commitListingImageAction,
  presignListingImageAction,
  removeListingImageAction,
  reorderListingImagesAction,
  setListingCheckAction,
  setPhotographyAction,
  setPrimaryImageAction,
} from '@/features/admin/listing-actions';
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
    vehicle: {
      id: '22222222-2222-4222-8222-222222222222',
      title: '2023 Hyundai Creta SX(O)',
      registrationNumber: 'KA01AB1234',
      registrationDisplay: 'KA 01 AB 1234',
      rtoCode: 'KA01',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX(O)',
      manufacturingYear: 2023,
      registrationYear: 2023,
      fuelType: 'PETROL',
      transmission: 'AUTOMATIC',
      bodyType: 'SUV',
      kilometersDriven: 22400,
      ownerCount: 1,
      color: 'WHITE',
      insuranceType: 'NONE',
      pricePaise: 145000000,
      priceLabel: '₹14,50,000',
      negotiability: 'FIXED',
      description: 'Single owner.',
      summary: 'Petrol · Automatic · 22,400 km',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-26T10:00:00.000Z',
    },
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
      imageCount: 0,
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
    images: {
      items: [
        {
          mediaId: '44444444-4444-4444-8444-444444444444',
          position: 0,
          isPrimary: true,
          url: 'https://placehold.co/1200x900/1f2937/e5e7eb.png?text=Front',
          fileName: 'creta-front.jpg',
          mimeType: 'image/jpeg',
          bytes: 1_284_512,
          width: 2400,
          height: 1800,
          uploadedAt: '2026-09-26T10:00:00.000Z',
        },
        {
          mediaId: '55555555-5555-4555-8555-555555555555',
          position: 1,
          isPrimary: false,
          url: 'https://placehold.co/1200x900/374151/e5e7eb.png?text=Rear',
          fileName: 'creta-rear.jpg',
          mimeType: 'image/jpeg',
          bytes: 1_104_220,
          width: 2400,
          height: 1800,
          uploadedAt: '2026-09-26T10:01:00.000Z',
        },
      ],
      min: 6,
      max: 20,
      canEdit: true,
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
    blockers: [{ code: 'TOO_FEW_IMAGES', message: '2 of the 6 images needed are uploaded.' }],
    assisted: { createdBy: null, submittedBy: null, reviewerIsAssistant: false },
    actions: {
      canEdit: true,
      canReserve: false,
      canMarkSold: false,
      canVerify: true,
      canRequestChanges: true,
      canReject: true,
      canApprove: false,
    },
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

  it('shows the uploaded images inside the photography panel (R45)', () => {
    render(<ListingReview detail={reviewDetail()} />);
    const panel = within(screen.getByRole('region', { name: 'Photography and images' }));
    expect(panel.getByAltText('Image 1, the primary image')).toBeInTheDocument();
    expect(panel.getByText('2 uploaded · 6 needed to approve · 20 at most')).toBeInTheDocument();
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

  it('offers Request changes and Reject in review, and holds Approve until nothing blocks it', () => {
    render(<ListingReview detail={reviewDetail()} />);
    const panel = within(screen.getByRole('region', { name: 'Moderation' }));
    expect(panel.getByRole('button', { name: 'Request changes' })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'Approve and publish' })).toBeDisabled();
    expect(panel.getByText('Not ready to approve')).toBeInTheDocument();
    expect(panel.getByText('2 of the 6 images needed are uploaded.')).toBeInTheDocument();
  });

  it('offers Approve once the API says nothing blocks it', async () => {
    const detail = reviewDetail();
    render(
      <ListingReview
        detail={{ ...detail, blockers: [], actions: { ...detail.actions, canApprove: true } }}
      />,
    );
    const panel = within(screen.getByRole('region', { name: 'Moderation' }));
    const approve = panel.getByRole('button', { name: 'Approve and publish' });
    expect(approve).toBeEnabled();
    expect(panel.queryByText('Not ready to approve')).not.toBeInTheDocument();

    fireEvent.click(approve);
    expect(await screen.findByRole('dialog', { name: 'Publish this listing' })).toBeInTheDocument();
  });

  it('shows the checklist read-only once the listing is out of review', () => {
    render(
      <ListingReview
        detail={reviewDetail({
          actions: {
            canEdit: false,
            canReserve: false,
            canMarkSold: false,
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

describe('approveListingAction', () => {
  it('approves and refreshes the review screen, the queue and the public pages', async () => {
    apiSend.mockResolvedValue(reviewDetail());
    expect(await approveListingAction(ID)).toEqual({ ok: true });
    expect(apiSend).toHaveBeenCalledWith('POST', `/v1/admin/listings/${ID}/approve`);
    expect(revalidations.paths).toEqual(
      expect.arrayContaining([`/admin/listings/${ID}`, '/admin/listings']),
    );
    expect(revalidations.tags).toEqual(
      expect.arrayContaining(['vehicles', 'dealers', 'dealer:sri']),
    );
  });

  it('passes on why the API refused', async () => {
    const { ApiError } = await import('@/lib/api');
    apiSend.mockRejectedValueOnce(
      new ApiError({
        type: 'x',
        title: 'Conflict',
        status: 409,
        code: 'LISTING_NOT_READY',
        detail: 'This listing is not ready to approve yet.',
      }),
    );
    expect(await approveListingAction(ID)).toEqual({
      ok: false,
      message: 'This listing is not ready to approve yet.',
    });
  });
});

describe('the image actions', () => {
  const MEDIA = '44444444-4444-4444-8444-444444444444';

  it('presigns a valid file and hands back the signed upload', async () => {
    apiSend.mockResolvedValue({ mediaId: MEDIA, uploadUrl: 'u', method: 'PUT', headers: {} });
    const result = await presignListingImageAction(ID, {
      fileName: 'front.jpg',
      mimeType: 'image/jpeg',
      bytes: 100,
    });

    expect(result).toMatchObject({ ok: true, upload: { mediaId: MEDIA } });
    expect(apiSend).toHaveBeenCalledWith('POST', `/v1/admin/listings/${ID}/images/presign`, {
      fileName: 'front.jpg',
      mimeType: 'image/jpeg',
      bytes: 100,
    });
  });

  it('refuses a file the contract refuses, without asking the API', async () => {
    const result = await presignListingImageAction(ID, {
      fileName: 'x.gif',
      mimeType: 'image/gif',
      bytes: 100,
    });
    expect(result.ok).toBe(false);
    expect(apiSend).not.toHaveBeenCalled();
  });

  it('passes on what the API said, or that it could not be reached', async () => {
    const { ApiError } = await import('@/lib/api');
    apiSend.mockRejectedValueOnce(
      new ApiError({
        type: 'x',
        title: 'Conflict',
        status: 409,
        code: 'VEHICLE_IMAGES_FULL',
        detail: 'A vehicle can carry at most 20 images.',
      }),
    );
    const full = await presignListingImageAction(ID, {
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
      bytes: 1,
    });
    expect(full).toEqual({ ok: false, message: 'A vehicle can carry at most 20 images.' });

    apiSend.mockRejectedValueOnce(new Error('down'));
    const down = await commitListingImageAction(ID, MEDIA);
    expect(down.ok).toBe(false);
    expect(down.message).toMatch(/unavailable/);
  });

  it('commits an upload by its ids and refuses ids that are not uuids', async () => {
    apiSend.mockResolvedValue({});
    expect(await commitListingImageAction(ID, MEDIA)).toEqual({ ok: true });
    expect(revalidations.paths).toEqual(
      expect.arrayContaining([`/admin/listings/${ID}`, '/admin/listings']),
    );
    expect(apiSend).toHaveBeenCalledWith('POST', `/v1/admin/listings/${ID}/images/${MEDIA}/commit`);

    expect((await commitListingImageAction(ID, '../../dealer')).ok).toBe(false);
    expect(apiSend).toHaveBeenCalledTimes(1);
  });

  it('removes an image and refreshes, and reports errors if the API is unreachable', async () => {
    const form = new FormData();
    form.set('listingId', ID);
    form.set('mediaId', MEDIA);
    apiSend.mockResolvedValueOnce({});
    await removeListingImageAction(form);
    expect(apiSend).toHaveBeenCalledWith('DELETE', `/v1/admin/listings/${ID}/images/${MEDIA}`);
    expect(revalidations.paths).toContain(`/admin/listings/${ID}`);

    apiSend.mockRejectedValueOnce(new Error('down'));
    await expect(removeListingImageAction(form)).resolves.toEqual({
      ok: false,
      message: 'The API is unavailable. Try again shortly.',
    });

    const { ApiError } = await import('@/lib/api');
    apiSend.mockRejectedValueOnce(
      new ApiError({ type: 'x', title: 'Conflict', status: 409, code: 'IMAGES_CLOSED' }),
    );
    await removeListingImageAction(form);
  });

  it('sends a new order and refreshes, and ignores a malformed one', async () => {
    const OTHER = '55555555-5555-4555-8555-555555555555';
    const form = new FormData();
    form.set('listingId', ID);
    form.set('order', `${OTHER},${MEDIA}`);
    apiSend.mockResolvedValueOnce({});
    await reorderListingImagesAction(form);
    expect(apiSend).toHaveBeenCalledWith('PUT', `/v1/admin/listings/${ID}/images/order`, {
      mediaIds: [OTHER, MEDIA],
    });
    expect(revalidations.paths).toContain(`/admin/listings/${ID}`);

    form.set('order', `${MEDIA},${MEDIA}`);
    await reorderListingImagesAction(form);
    form.set('listingId', 'not-a-uuid');
    form.set('order', MEDIA);
    await reorderListingImagesAction(form);
    expect(apiSend).toHaveBeenCalledTimes(1);

    form.set('listingId', ID);
    apiSend.mockRejectedValueOnce(new Error('down'));
    await expect(reorderListingImagesAction(form)).rejects.toThrow(/unavailable/);
  });

  it('chooses the primary image and refreshes', async () => {
    const form = new FormData();
    form.set('listingId', ID);
    form.set('mediaId', MEDIA);
    apiSend.mockResolvedValueOnce({});
    await setPrimaryImageAction(form);
    expect(apiSend).toHaveBeenCalledWith('PUT', `/v1/admin/listings/${ID}/images/${MEDIA}/primary`);
    expect(revalidations.paths).toContain(`/admin/listings/${ID}`);

    const { ApiError } = await import('@/lib/api');
    apiSend.mockRejectedValueOnce(
      new ApiError({ type: 'x', title: 'Conflict', status: 409, code: 'IMAGES_CLOSED' }),
    );
    await setPrimaryImageAction(form);

    apiSend.mockRejectedValueOnce(new Error('down'));
    await expect(setPrimaryImageAction(form)).rejects.toThrow(/unavailable/);

    await setPrimaryImageAction(new FormData());
    expect(apiSend).toHaveBeenCalledTimes(3);
  });

  it('ignores a removal form without valid ids', async () => {
    await removeListingImageAction(new FormData());
    expect(apiSend).not.toHaveBeenCalled();
  });
});

describe('a listing Sales prepared (R114)', () => {
  it('names who prepared and submitted it, and warns a reviewer who did', () => {
    render(
      <ListingReview
        detail={{
          ...reviewDetail(),
          assisted: {
            createdBy: { name: 'Arun', email: 'arun@dealers-drive.in' },
            submittedBy: { name: 'Arun', email: 'arun@dealers-drive.in' },
            reviewerIsAssistant: true,
          },
        }}
      />,
    );
    expect(screen.getByText('Prepared by Dealers-Drive Sales: Arun')).toBeInTheDocument();
    expect(screen.getByText('Submitted by Dealers-Drive Sales: Arun')).toBeInTheDocument();
    expect(screen.getByText(/another reviewer has to decide/)).toBeInTheDocument();
  });
});

function activeDetail(): AdminListingDetail {
  const detail = reviewDetail();
  return {
    ...detail,
    listing: { ...detail.listing, status: 'ACTIVE', statusLabel: 'Active' },
    actions: {
      ...detail.actions,
      canEdit: true,
      canReserve: true,
      canMarkSold: true,
      canVerify: false,
      canApprove: false,
      canReject: false,
      canRequestChanges: false,
    },
  };
}

describe('admin listing management', () => {
  it('saves active insurance changes without a date and refreshes public and dealer views', async () => {
    const detail = activeDetail();
    apiSend.mockResolvedValue(detail);
    render(<ListingReview detail={detail} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
    const insurance = screen.getByRole('combobox', { name: 'Insurance' });
    expect(
      within(insurance)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Choose…', 'None', 'Live']);
    expect(screen.queryByLabelText('Insurance valid until')).not.toBeInTheDocument();
    fireEvent.change(insurance, { target: { value: 'LIVE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    await waitFor(() =>
      expect(apiSend).toHaveBeenCalledWith(
        'PATCH',
        `/v1/admin/listings/${ID}/vehicle`,
        expect.objectContaining({
          expectedUpdatedAt: detail.vehicle.updatedAt,
          details: expect.objectContaining({
            insuranceType: 'LIVE',
            pricePaise: 145000000,
          }) as unknown,
        }),
      ),
    );
    expect(screen.getByText('Vehicle details saved.')).toBeInTheDocument();
    expect(revalidations.tags).toEqual(
      expect.arrayContaining(['vehicles', 'dealers', 'dealer:sri']),
    );
    expect(revalidations.paths).toContain(`/dealer/vehicles/${detail.listing.vehicleId}`);
  });
  it('keeps edited values and the original version after a stale-save refusal', async () => {
    const { ApiError } = await import('@/lib/api');
    const detail = activeDetail();
    apiSend.mockRejectedValue(
      new ApiError({
        type: 'x',
        title: 'Vehicle changed',
        detail: 'Reload the page before saving.',
        status: 409,
        code: 'VEHICLE_CHANGED',
      }),
    );
    const view = render(<ListingReview detail={detail} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Insurance' }), {
      target: { value: 'LIVE' },
    });
    view.rerender(
      <ListingReview
        detail={{
          ...detail,
          vehicle: { ...detail.vehicle, updatedAt: '2026-10-23T11:00:00.000Z' },
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    await screen.findByText('Reload the page before saving.');
    expect(screen.getByRole('combobox', { name: 'Insurance' })).toHaveValue('LIVE');
    expect(apiSend.mock.calls[0]?.[2] as unknown).toMatchObject({
      expectedUpdatedAt: detail.vehicle.updatedAt,
    });
    expect(revalidations.tags).toEqual([]);
  });
  it.each(['reserve', 'mark-sold'] as const)(
    'requires confirmation for %s and refreshes after success',
    async (action) => {
      apiSend.mockResolvedValue(activeDetail());
      render(<ListingReview detail={activeDetail()} />);
      fireEvent.click(
        screen.getByRole('button', { name: action === 'reserve' ? 'Mark reserved' : 'Mark sold' }),
      );
      expect(apiSend).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole('button', {
          name: action === 'reserve' ? 'Confirm reservation' : 'Confirm sold',
        }),
      );
      await waitFor(() =>
        expect(apiSend).toHaveBeenCalledWith('POST', `/v1/admin/listings/${ID}/${action}`),
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(revalidations.tags).toContain('vehicles');
    },
  );
  it('cancels a reservation without writing anything and restores keyboard focus', async () => {
    render(<ListingReview detail={activeDetail()} />);
    const trigger = screen.getByRole('button', { name: 'Mark reserved' });
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(apiSend).not.toHaveBeenCalled();
  });
  it('validates ids, versions and protected fields before calling the API', async () => {
    expect((await updateListingVehicleAction('bad', {})).ok).toBe(false);
    expect(
      (
        await updateListingVehicleAction(ID, {
          details: { insuranceValidUntil: '2027-01-01' },
          expectedUpdatedAt: activeDetail().vehicle.updatedAt,
        })
      ).ok,
    ).toBe(false);
    expect((await changeListingAvailabilityAction('bad', 'reserve')).ok).toBe(false);
    expect(apiSend).not.toHaveBeenCalled();
  });
  it('shows API field errors beside the edited values', async () => {
    const { ApiError } = await import('@/lib/api');
    apiSend.mockRejectedValue(
      new ApiError({
        type: 'x',
        title: 'Incomplete',
        status: 422,
        code: 'VEHICLE_INCOMPLETE',
        errors: [
          { field: 'body.details.pricePaise', code: 'REQUIRED', message: 'Check the price.' },
        ],
      }),
    );
    render(<ListingReview detail={activeDetail()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('Check the price.')).toBeInTheDocument();
  });
});
