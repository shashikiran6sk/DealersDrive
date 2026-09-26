import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import EditVehiclePage from '@/app/(dealer)/dealer/vehicles/[id]/edit/page';
import NewVehiclePage from '@/app/(dealer)/dealer/vehicles/new/page';
import type * as ApiModule from '@/lib/api';

const apiGetParsed = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown };
});

const ID = '22222222-2222-4222-8222-222222222222';

function stored() {
  return {
    id: ID,
    title: 'KA 01 AB 1234',
    registrationNumber: 'KA01AB1234',
    registrationDisplay: 'KA 01 AB 1234',
    rtoCode: 'KA01',
    make: null,
    model: null,
    variant: null,
    manufacturingYear: null,
    registrationYear: null,
    fuelType: null,
    transmission: null,
    bodyType: null,
    kilometersDriven: null,
    ownerCount: null,
    color: null,
    insuranceType: null,
    insuranceValidUntil: null,
    pricePaise: null,
    priceLabel: null,
    negotiability: null,
    description: null,
    summary: '',
    issues: [{ field: 'make', message: 'Make is required.' }],
    complete: false,
    listing: {
      id: '33333333-3333-4333-8333-333333333333',
      status: 'DRAFT',
      statusLabel: 'Draft',
      statusTone: 'neutral',
      reason: null,
      submittedAt: null,
      publishedAt: null,
      canEdit: true,
      canSubmit: false,
      canDelete: true,
    },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

async function page(step?: string) {
  return EditVehiclePage({
    params: Promise.resolve({ id: ID }),
    searchParams: Promise.resolve(step ? { step } : {}),
  });
}

describe('/dealer/vehicles/new', () => {
  it('opens on the registration step', () => {
    render(NewVehiclePage());
    expect(screen.getByRole('heading', { level: 1, name: 'Add vehicle' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /registration number/i })).toBeInTheDocument();
  });
});

describe('/dealer/vehicles/[id]/edit', () => {
  it('reads the dealer’s own vehicle, uncached, and opens the step in the URL', async () => {
    apiGetParsed.mockResolvedValue(stored());
    render(await page('details'));

    expect(apiGetParsed).toHaveBeenCalledWith(expect.anything(), `/v1/dealer/vehicles/${ID}`, {
      revalidate: false,
    });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/history/i);
  });

  it('falls back to the basics step for a step it does not know', async () => {
    apiGetParsed.mockResolvedValue(stored());
    render(await page('photos'));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('What is it?');
  });

  it('answers another dealership’s vehicle with a 404 page', async () => {
    const { ApiError } = await import('@/lib/api');
    apiGetParsed.mockRejectedValue(
      new ApiError({ type: 'x', title: 'Not found', status: 404, code: 'VEHICLE_NOT_FOUND' }),
    );
    await expect(page()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('lets any other failure reach the error boundary', async () => {
    apiGetParsed.mockRejectedValue(new Error('boom'));
    await expect(page()).rejects.toThrow('boom');
  });
});
