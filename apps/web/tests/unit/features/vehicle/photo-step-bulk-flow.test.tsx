import type { VehiclePhotoSlot } from '@dealers-drive/contracts';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PhotoStep } from '@/features/vehicle/photo-step';
import type * as PhotoStepUtils from '@/features/vehicle/photo-step/utils';
import { UploadFailure } from '@/lib/upload';

import { navigationState } from '../../../setup';
import { VEHICLE_ID, photos } from './fixtures';

const revoke = vi.fn();

const uploads = vi.hoisted(() => ({
  calls: [] as { slot: VehiclePhotoSlot; name: string }[],
  failOn: null as string | null,
}));

vi.mock('@/features/vehicle/photo-step/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof PhotoStepUtils>();
  const { photos: fixture } = await import('./fixtures');
  return {
    ...actual,
    uploadPhoto: (_vehicleId: string, slot: VehiclePhotoSlot, file: File) => {
      if (file.name === uploads.failOn)
        return Promise.reject(new UploadFailure('Storage said no.'));
      uploads.calls.push({ slot, name: file.name });
      const standard = uploads.calls.filter((call) => call.slot !== 'EXTRA').length;
      return Promise.resolve(fixture({ plan: 'DEALER' }, standard));
    },
  };
});

function shots(count: number): File[] {
  return Array.from(
    { length: count },
    (_, index) =>
      new File(['x'], `IMG_${String(index + 1)}.png`, { type: 'image/png', lastModified: 1 }),
  );
}

async function choose(files: File[]): Promise<void> {
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Choose photos'), { target: { files } });
    await Promise.resolve();
  });
}

function renderStep(uploaded = 0) {
  return render(
    <PhotoStep
      vehicleId={VEHICLE_ID}
      photos={photos({ plan: 'DEALER' }, uploaded)}
      backHref="/back"
      nextHref="/review"
    />,
  );
}

beforeEach(() => {
  uploads.calls = [];
  uploads.failOn = null;
  let next = 0;
  URL.createObjectURL = vi.fn(() => {
    next += 1;
    return `blob:preview-${String(next)}`;
  });
  revoke.mockClear();
  URL.revokeObjectURL = revoke;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('uploading every photo at once', () => {
  it('is the default for a car with no photos yet, and hides the ten upload cards', () => {
    renderStep();
    expect(screen.getByRole('radio', { name: /All at once/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.queryAllByRole('img', { name: /^a dealer in position/i })).toHaveLength(0);
    expect(screen.getByLabelText('Choose photos')).toHaveAttribute('multiple');

    fireEvent.click(screen.getByRole('radio', { name: /One shot at a time/ }));
    expect(screen.getAllByRole('img', { name: /^a dealer in position/i })).toHaveLength(10);
  });

  it('keeps one shot at a time for a car that already has photos', () => {
    renderStep(3);
    expect(screen.getByRole('radio', { name: /One shot at a time/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('puts the photos in order, lets the dealer swap two, uploads them and moves on to review', async () => {
    renderStep();
    await choose(shots(11).reverse());

    expect(screen.getByRole('heading', { name: 'Check the order' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Select the photo for 1 · / }));
    expect(screen.getByText(/Now tap where your front three-quarter/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Move the selected photo to 2 · / }));

    const upload = screen.getByRole('button', { name: 'Upload 11 photos and continue' });
    await act(async () => {
      fireEvent.click(upload);
      await Promise.resolve();
    });

    await waitFor(() => expect(navigationState.pushed).toContain('/review'));
    expect(uploads.calls.map((call) => [call.slot, call.name])).toEqual([
      ['FRONT_THREE_QUARTER_RIGHT', 'IMG_2.png'],
      ['FRONT', 'IMG_1.png'],
      ['FRONT_THREE_QUARTER_LEFT', 'IMG_3.png'],
      ['LEFT_SIDE', 'IMG_4.png'],
      ['REAR', 'IMG_5.png'],
      ['RIGHT_SIDE', 'IMG_6.png'],
      ['FRONT_SEATS', 'IMG_7.png'],
      ['REAR_SEATS', 'IMG_8.png'],
      ['DASHBOARD', 'IMG_9.png'],
      ['ODOMETER', 'IMG_10.png'],
      ['EXTRA', 'IMG_11.png'],
    ]);
  });

  it('says what is missing, leaves out what is not a photo, and only uploads when short', async () => {
    renderStep();
    await choose([...shots(8), new File(['x'], 'notes.pdf', { type: 'application/pdf' })]);

    expect(screen.getByText(/One file was not a JPEG, PNG or WebP photo/)).toBeInTheDocument();
    expect(screen.getByText('Still missing: Dashboard, Odometer.')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Upload 8 photos' }));
      await Promise.resolve();
    });
    await waitFor(() => expect(uploads.calls).toHaveLength(8));
    expect(navigationState.pushed).not.toContain('/review');
    expect(
      screen.getByText(
        '8 of the ten are already uploaded. New photos fill the shots still missing.',
      ),
    ).toBeInTheDocument();
  });

  it('keeps a photo that failed to upload, so the dealer can try again', async () => {
    uploads.failOn = 'IMG_2.png';
    renderStep();
    await choose(shots(2));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Upload 2 photos' }));
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(screen.getByText(/One photo could not be uploaded/)).toBeInTheDocument(),
    );
    const failed = screen.getByRole('button', { name: /^Select the photo for 2 · / }).parentElement;
    expect(within(failed ?? document.body).getByText('Not uploaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload 1 photo' })).toBeEnabled();
  });

  it('removes a photo and starts over', async () => {
    renderStep();
    await choose(shots(2));
    fireEvent.click(screen.getByRole('button', { name: /^Remove the photo for 2 · / }));
    expect(screen.getByRole('button', { name: 'Upload 1 photo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(
      screen.getByRole('heading', { name: 'Upload all your photos at once' }),
    ).toBeInTheDocument();
    expect(revoke).toHaveBeenCalledTimes(2);
  });
});
