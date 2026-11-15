import type { AdminSubmittedPhotos } from '@dealers-drive/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const action = vi.hoisted(() => vi.fn());
vi.mock('@/features/admin/submitted-photos-actions', () => ({
  submittedPhotosDownloadAction: action,
}));
const start = vi.hoisted(() => vi.fn());
vi.mock('@/features/admin/listing-review/utils', () => ({ startDownload: start }));

import { SubmittedPhotosPanel } from '@/features/admin/listing-review/submitted-photos-panel';

const LISTING = '11111111-1111-4111-8111-111111111111';
const MEDIA = '22222222-2222-4222-8222-222222222222';

function photos(): AdminSubmittedPhotos {
  return {
    plan: 'DEALER',
    planLabel: 'Dealer uploads the photographs',
    archiveName: '2016-hyundai-creta-sx.zip',
    items: [
      {
        mediaId: MEDIA,
        slot: 'FRONT_THREE_QUARTER_RIGHT',
        slotLabel: 'Front three-quarter · driver side',
        url: '/x.jpg',
        downloadName: '2016-hyundai-creta-sx-01-front-three-quarter-driver-side.jpg',
        fileName: 'IMG_1.jpg',
        mimeType: 'image/jpeg',
        bytes: 3_000_000,
        uploadedAt: '2026-11-15T09:00:00.000Z',
      },
    ],
    missing: [],
  };
}

afterEach(() => {
  action.mockReset();
  start.mockReset();
});

describe('downloading the dealer’s photographs', () => {
  it('fetches a zip link for the whole set and saves it', async () => {
    action.mockResolvedValue({
      ok: true,
      url: 'https://storage/zip',
      fileName: '2016-hyundai-creta-sx.zip',
    });
    render(<SubmittedPhotosPanel listingId={LISTING} photos={photos()} />);
    expect(screen.getByText('Saves as 2016-hyundai-creta-sx.zip')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Download all 1 as a zip' }));
    await waitFor(() => expect(start).toHaveBeenCalledWith('https://storage/zip'));
    expect(action).toHaveBeenCalledWith(LISTING, undefined);
  });

  it('downloads one photograph on its own', async () => {
    action.mockResolvedValue({ ok: true, url: 'https://storage/one', fileName: 'x.jpg' });
    render(<SubmittedPhotosPanel listingId={LISTING} photos={photos()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(start).toHaveBeenCalledWith('https://storage/one'));
    expect(action).toHaveBeenCalledWith(LISTING, MEDIA);
  });

  it('says so when the download cannot be prepared', async () => {
    action.mockResolvedValue({ ok: false, message: 'The download could not be prepared.' });
    render(<SubmittedPhotosPanel listingId={LISTING} photos={photos()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download all 1 as a zip' }));
    expect(await screen.findByText('The download could not be prepared.')).toBeInTheDocument();
    expect(start).not.toHaveBeenCalled();
  });
});
