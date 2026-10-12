import type { DealerPortfolioPhoto, DealerPortfolioResponse } from '@dealers-drive/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PortfolioManager } from '@/features/dealer/portfolio-manager';

import { navigationState } from '../../../setup';

/**
 * #299 — the owner's portfolio manager at `/dealer/photos`.
 *
 * What it must get right is the moderation story told back to the dealer:
 * every status is labelled, Replace is offered only where the API would
 * accept a replacement (an approved photograph with none already waiting),
 * Add is refused at the limit, and a replacement carries `replacesId` through
 * both halves of the upload so the approved photograph stays up meanwhile.
 */
const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

const MEDIA_ID = '00000000-0000-4000-8000-0000000000aa';

function photo(n: number, overrides: Partial<DealerPortfolioPhoto> = {}): DealerPortfolioPhoto {
  return {
    id: `00000000-0000-4000-8000-00000000000${String(n)}`,
    status: 'APPROVED',
    statusLabel: 'Approved — shown on your page',
    previewUrl: `https://media.test/portfolio/${String(n)}.webp`,
    caption: null,
    replacesId: null,
    position: n,
    rejectionReason: null,
    submittedAt: '2026-10-01T10:00:00.000Z',
    reviewedAt: null,
    ...overrides,
  };
}

function portfolio(
  data: DealerPortfolioPhoto[],
  overrides: Partial<DealerPortfolioResponse> = {},
): DealerPortfolioResponse {
  return { data, limit: 8, canAdd: true, ...overrides };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubUpload() {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    void init;
    if (url.endsWith('/presign')) {
      return Promise.resolve(
        json(
          {
            mediaId: MEDIA_ID,
            uploadUrl: 'https://storage.test/put',
            method: 'PUT',
            headers: {},
            expiresInSeconds: 300,
          },
          201,
        ),
      );
    }
    if (url.endsWith('/commit')) return Promise.resolve(json(photo(9, { status: 'PENDING' }), 201));
    return Promise.resolve(new Response(null, { status: 200 }));
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function bodyOf(fetchMock: ReturnType<typeof stubUpload>, suffix: string): unknown {
  const call = fetchMock.mock.calls.find(([url]) => url.endsWith(suffix));
  const body = call?.[1]?.body;
  return typeof body === 'string' ? (JSON.parse(body) as unknown) : null;
}

const IMAGE = () => new File(['jpeg'], 'yard.jpg', { type: 'image/jpeg' });

describe('the photographs and what each one is waiting for', () => {
  it('labels every status, and tells the dealer why one was rejected', () => {
    render(
      <PortfolioManager
        portfolio={portfolio([
          photo(1),
          photo(2, { status: 'PENDING' }),
          photo(3, { status: 'REJECTED', rejectionReason: 'This is a photo of one car.' }),
        ])}
      />,
    );

    expect(screen.getByText('Approved — shown on your page')).toBeInTheDocument();
    expect(screen.getByText('Awaiting review — not public yet')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('Not approved: This is a photo of one car.')).toBeInTheDocument();
  });

  it('explains that photographs are reviewed before they are public', () => {
    render(<PortfolioManager portfolio={portfolio([])} />);

    expect(
      screen.getByText(
        'Photos appear on your public page after our team approves them. Your current photo stays up until its replacement is approved.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('No photos yet')).toBeInTheDocument();
  });

  it('offers Replace on an approved photograph only', () => {
    render(
      <PortfolioManager
        portfolio={portfolio([
          photo(1),
          photo(2, { status: 'PENDING' }),
          photo(3, { status: 'REJECTED' }),
        ])}
      />,
    );

    expect(screen.getByRole('button', { name: 'Replace photo 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace photo 2' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace photo 3' })).not.toBeInTheDocument();
  });

  it('hides Replace while a replacement is already waiting, and says what the pending one replaces', () => {
    const approved = photo(1);
    render(
      <PortfolioManager
        portfolio={portfolio([approved, photo(2, { status: 'PENDING', replacesId: approved.id })])}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Replace photo 1' })).not.toBeInTheDocument();
    expect(screen.getByText('A replacement is awaiting review.')).toBeInTheDocument();
    expect(
      screen.getByText('Replacement for photo 1 — that photo stays up until this is approved.'),
    ).toBeInTheDocument();
  });

  it('counts approved and pending photographs, but not a waiting replacement, against the limit', () => {
    const approved = photo(1);
    render(
      <PortfolioManager
        portfolio={portfolio([
          approved,
          photo(2, { status: 'PENDING', replacesId: approved.id }),
          photo(3, { status: 'REJECTED' }),
        ])}
      />,
    );

    expect(screen.getByText('1 of 8 photos')).toBeInTheDocument();
  });

  it('counts an approved replacement like any approved photograph', () => {
    const replaced = photo(1, { status: 'APPROVED', replacesId: photo(9).id });
    render(<PortfolioManager portfolio={portfolio([replaced, photo(2)])} />);

    expect(screen.getByText('2 of 8 photos')).toBeInTheDocument();
  });

  it('disables Add photo when the portfolio is full, and says so', () => {
    render(
      <PortfolioManager
        portfolio={portfolio(
          Array.from({ length: 8 }, (_, index) => photo(index + 1)),
          { canAdd: false },
        )}
      />,
    );

    expect(screen.getByRole('button', { name: 'Add photo' })).toBeDisabled();
    expect(
      screen.getByText(
        'You have 8 photos. Remove one to add another, or replace an approved photo.',
      ),
    ).toBeInTheDocument();
  });
});

describe('uploading', () => {
  it('adds a photograph through presign, storage and commit, with its caption', async () => {
    const fetchMock = stubUpload();
    const user = userEvent.setup();
    render(<PortfolioManager portfolio={portfolio([])} />);

    await user.click(screen.getByRole('button', { name: 'Add photo' }));
    const dialog = await screen.findByRole('dialog');
    await user.upload(within(dialog).getByLabelText(/Photograph/), IMAGE());
    await user.type(within(dialog).getByLabelText(/Caption/), '  Our yard  ');
    await user.click(within(dialog).getByRole('button', { name: 'Submit for review' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/dealer/portfolio/presign',
      'https://storage.test/put',
      '/api/dealer/portfolio/commit',
    ]);
    expect(bodyOf(fetchMock, '/presign')).toEqual({
      fileName: 'yard.jpg',
      mimeType: 'image/jpeg',
      bytes: 4,
    });
    expect(bodyOf(fetchMock, '/commit')).toEqual({ mediaId: MEDIA_ID, caption: 'Our yard' });
    expect(
      await screen.findByText(
        'Photo submitted. It appears on your page once our team approves it.',
      ),
    ).toBeInTheDocument();
    expect(navigationState.refreshed).toBe(1);
  });

  it('names the photograph it replaces in both the presign and the commit', async () => {
    const fetchMock = stubUpload();
    const user = userEvent.setup();
    const approved = photo(1);
    render(<PortfolioManager portfolio={portfolio([approved])} />);

    await user.click(screen.getByRole('button', { name: 'Replace photo 1' }));
    const dialog = await screen.findByRole('dialog');
    await user.upload(within(dialog).getByLabelText(/Photograph/), IMAGE());
    await user.click(within(dialog).getByRole('button', { name: 'Submit for review' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    expect(bodyOf(fetchMock, '/presign')).toMatchObject({ replacesId: approved.id });
    expect(bodyOf(fetchMock, '/commit')).toEqual({ mediaId: MEDIA_ID, replacesId: approved.id });
  });

  it('refuses a file that is not a photograph before anything is sent', async () => {
    const fetchMock = stubUpload();
    const user = userEvent.setup({ applyAccept: false });
    render(<PortfolioManager portfolio={portfolio([])} />);

    await user.click(screen.getByRole('button', { name: 'Add photo' }));
    const dialog = await screen.findByRole('dialog');
    await user.upload(
      within(dialog).getByLabelText(/Photograph/),
      new File(['%PDF'], 'gst.pdf', { type: 'application/pdf' }),
    );

    expect(within(dialog).getByText('Choose a JPEG, PNG or WebP photograph.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Submit for review' })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the API’s own sentence when an upload is refused', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        json(
          {
            type: 'about:blank',
            title: 'Conflict',
            status: 409,
            code: 'PORTFOLIO_FULL',
            detail: 'Your portfolio already has the most photographs it can hold.',
          },
          409,
        ),
      ),
    );
    const user = userEvent.setup();
    render(<PortfolioManager portfolio={portfolio([])} />);

    await user.click(screen.getByRole('button', { name: 'Add photo' }));
    const dialog = await screen.findByRole('dialog');
    await user.upload(within(dialog).getByLabelText(/Photograph/), IMAGE());
    await user.click(within(dialog).getByRole('button', { name: 'Submit for review' }));

    expect(
      await within(dialog).findByText(
        'Your portfolio already has the most photographs it can hold.',
      ),
    ).toBeInTheDocument();
  });
});

describe('removing', () => {
  it('asks first, then deletes through the dealer’s own route', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    globalThis.fetch = fetchMock;
    const user = userEvent.setup();
    const approved = photo(1);
    render(<PortfolioManager portfolio={portfolio([approved])} />);

    await user.click(screen.getByRole('button', { name: 'Remove photo 1' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(
        'It comes off your public page straight away. This cannot be undone.',
      ),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Remove photo' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/api/dealer/portfolio/${approved.id}`, {
        method: 'DELETE',
      });
    });
    expect(await screen.findByText('Photo removed.')).toBeInTheDocument();
  });
});
