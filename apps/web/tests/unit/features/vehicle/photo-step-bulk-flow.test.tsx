import type { DealerSubmissionPhoto, VehiclePhotoSlot } from '@dealers-drive/contracts';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PhotoStep } from '@/features/vehicle/photo-step';
import type * as PhotoStepUtils from '@/features/vehicle/photo-step/utils';
import { UploadFailure } from '@/lib/upload';

import { VEHICLE_ID, photos } from './fixtures';

const server = vi.hoisted(() => ({
  calls: [] as { slot: VehiclePhotoSlot; name: string }[],
  removed: [] as string[],
  failOn: new Set<string>(),
}));

vi.mock('@/features/vehicle/photo-step/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof PhotoStepUtils>();
  const { photos: fixture } = await import('./fixtures');
  function current() {
    const unsorted: DealerSubmissionPhoto[] = server.calls
      .filter((call) => !server.removed.includes(call.name))
      .map((call, index) => ({
        mediaId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        slot: call.slot,
        slotLabel: 'Photo',
        url: `/u/${call.name}`,
        fileName: call.name,
        bytes: 1,
        uploadedAt: '2026-11-15T09:00:00.000Z',
      }));
    return fixture({ plan: 'DEALER', unsorted }, 0);
  }
  return {
    ...actual,
    uploadPhoto: (_vehicleId: string, slot: VehiclePhotoSlot, file: File) => {
      if (server.failOn.has(file.name)) {
        server.failOn.delete(file.name);
        return Promise.reject(new UploadFailure('Storage said no.'));
      }
      server.calls.push({ slot, name: file.name });
      return Promise.resolve(current());
    },
    removePhoto: (_vehicleId: string, mediaId: string) => {
      const index = Number(mediaId.slice(-12));
      const name = server.calls.filter((call) => !server.removed.includes(call.name))[index]?.name;
      if (name) server.removed.push(name);
      return Promise.resolve(current());
    },
  };
});

function pictures(count: number): File[] {
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

function listedNames(): string[] {
  const list = screen.getByRole('list', { name: 'Uploaded photos' });
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('.truncate')?.textContent ?? '');
}

beforeEach(() => {
  server.calls = [];
  server.removed = [];
  server.failOn = new Set();
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

  it('keeps one shot at a time for a car that already has shots', () => {
    renderStep(3);
    expect(screen.getByRole('radio', { name: /One shot at a time/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('uploads the photos straight away, unsorted, oldest first, and lists their names', async () => {
    renderStep();
    await choose(pictures(10).reverse());

    await waitFor(() => expect(server.calls).toHaveLength(10));
    expect(server.calls.every((call) => call.slot === 'UNSORTED')).toBe(true);
    expect(server.calls.map((call) => call.name)).toEqual(pictures(10).map((file) => file.name));
    await waitFor(() => expect(listedNames()).toHaveLength(10));
    expect(listedNames()[0]).toBe('IMG_1.png');
    expect(
      screen.getByText('10 photos uploaded. You can continue to review and submit the car.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Check the order/)).not.toBeInTheDocument();
  });

  it('counts towards ten and leaves out a file that is not a photo', async () => {
    renderStep();
    await choose([...pictures(4), new File(['x'], 'notes.pdf', { type: 'application/pdf' })]);
    await waitFor(() => expect(server.calls).toHaveLength(4));
    expect(screen.getByText(/One file was not a JPEG, PNG or WebP photo/)).toBeInTheDocument();
    expect(screen.getByText('4 of 10 photos uploaded')).toBeInTheDocument();
  });

  it('keeps a photo that failed, tries it again, or drops it', async () => {
    server.failOn = new Set(['IMG_2.png', 'IMG_3.png']);
    renderStep();
    await choose(pictures(3));
    await waitFor(() => expect(screen.getAllByText('Storage said no.')).toHaveLength(2));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await Promise.resolve();
    });
    await waitFor(() => expect(server.calls.map((call) => call.name)).toContain('IMG_3.png'));
    expect(screen.queryByText('Storage said no.')).not.toBeInTheDocument();

    server.failOn = new Set(['IMG_9.png']);
    await choose([new File(['x'], 'IMG_9.png', { type: 'image/png' })]);
    await waitFor(() => expect(screen.getByText('Storage said no.')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Remove IMG_9.png' }));
    expect(screen.queryByText('IMG_9.png')).not.toBeInTheDocument();
  });

  it('removes an uploaded photo', async () => {
    renderStep();
    await choose(pictures(2));
    await waitFor(() => expect(listedNames()).toEqual(['IMG_1.png', 'IMG_2.png']));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove IMG_1.png' }));
      await Promise.resolve();
    });
    await waitFor(() => expect(listedNames()).toEqual(['IMG_2.png']));
  });
});
