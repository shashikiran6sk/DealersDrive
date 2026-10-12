import type { AdminPortfolioPhoto, AdminPortfolioQueue } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminPortfolioPage from '@/app/(admin)/admin/portfolio/page';
import { PortfolioModerationCard } from '@/features/admin/portfolio-moderation';
import type * as ApiModule from '@/lib/api';
import { ApiError } from '@/lib/api';

import { navigationState } from '../../../setup';

/**
 * #299 — the queue a moderator approves dealer portfolio photographs from.
 *
 * The decisions are Server Actions that already exist; what the card owns is
 * that a refusal cannot leave without a reason, that a replacement is judged
 * beside the photograph it would take down, and that the page says plainly
 * when the operator is not a reviewer rather than throwing.
 */
const apiGetParsed = vi.fn();
const approvePortfolioPhotoAction = vi.fn();
const rejectPortfolioPhotoAction = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown };
});

vi.mock('@/features/admin/portfolio-actions', () => ({
  approvePortfolioPhotoAction: (...args: unknown[]) =>
    approvePortfolioPhotoAction(...args) as unknown,
  rejectPortfolioPhotoAction: (...args: unknown[]) =>
    rejectPortfolioPhotoAction(...args) as unknown,
}));

function photo(overrides: Partial<AdminPortfolioPhoto> = {}): AdminPortfolioPhoto {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    status: 'PENDING',
    statusLabel: 'Awaiting review — not public yet',
    previewUrl: 'https://media.test/signed/new.webp',
    caption: 'The yard from the road',
    replacesId: null,
    position: 1,
    rejectionReason: null,
    submittedAt: '2026-10-10T05:30:00.000Z',
    reviewedAt: null,
    dealerId: '33333333-3333-4333-8333-333333333333',
    dealerName: 'Sri Lakshmi Motors',
    dealerSlug: 'sri-lakshmi-motors',
    replacesPreviewUrl: null,
    ...overrides,
  };
}

beforeEach(() => {
  apiGetParsed.mockReset();
  approvePortfolioPhotoAction.mockReset().mockResolvedValue({ ok: true });
  rejectPortfolioPhotoAction.mockReset().mockResolvedValue({ ok: true });
});

describe('the moderation card', () => {
  it('links the dealership and approves through the action, naming the dealer to revalidate', async () => {
    const user = userEvent.setup();
    render(<PortfolioModerationCard photo={photo()} />);

    expect(screen.getByRole('link', { name: 'Sri Lakshmi Motors' })).toHaveAttribute(
      'href',
      '/admin/dealers/33333333-3333-4333-8333-333333333333',
    );
    expect(screen.getByText('The yard from the road')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(approvePortfolioPhotoAction).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      'sri-lakshmi-motors',
    );
    expect(navigationState.refreshed).toBe(1);
  });

  it('will not reject without a reason the dealer can act on', async () => {
    const user = userEvent.setup();
    render(<PortfolioModerationCard photo={photo()} />);

    await user.click(screen.getByRole('button', { name: 'Reject…' }));
    const reject = screen.getByRole('button', { name: 'Reject photo' });
    expect(reject).toBeDisabled();

    await user.type(screen.getByLabelText(/Why is it rejected/), 'Dark');
    expect(reject).toBeDisabled();

    await user.type(screen.getByLabelText(/Why is it rejected/), ' and blurry');
    expect(reject).toBeEnabled();
    await user.click(reject);

    expect(rejectPortfolioPhotoAction).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      'Dark and blurry',
      'sri-lakshmi-motors',
    );
    expect(approvePortfolioPhotoAction).not.toHaveBeenCalled();
  });

  it('shows a refused decision rather than swallowing it', async () => {
    approvePortfolioPhotoAction.mockResolvedValue({
      ok: false,
      message: 'That photograph has already been reviewed. Reload the queue.',
    });
    const user = userEvent.setup();
    render(<PortfolioModerationCard photo={photo()} />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(
      await screen.findByText('That photograph has already been reviewed. Reload the queue.'),
    ).toBeInTheDocument();
    expect(navigationState.refreshed).toBe(0);
  });

  it('puts a replacement beside the approved photograph it would take down', () => {
    render(
      <PortfolioModerationCard
        photo={photo({
          replacesId: '00000000-0000-4000-8000-000000000009',
          replacesPreviewUrl: 'https://media.test/signed/live.webp',
        })}
      />,
    );

    expect(screen.getByText('Replacement')).toBeInTheDocument();
    expect(screen.getByText('Live now')).toBeInTheDocument();
    expect(screen.getByText('Proposed replacement')).toBeInTheDocument();
    expect(
      screen.getByAltText('Sri Lakshmi Motors — the approved photo on their page now'),
    ).toHaveAttribute('src', 'https://media.test/signed/live.webp');
    expect(
      screen.getByAltText('Sri Lakshmi Motors — the photo submitted for review'),
    ).toHaveAttribute('src', 'https://media.test/signed/new.webp');
  });

  it('shows a rejected photograph with its reason and no decision to make', () => {
    render(
      <PortfolioModerationCard
        photo={photo({
          status: 'REJECTED',
          rejectionReason: 'A photo of one car, not the dealership.',
          reviewedAt: '2026-10-11T05:30:00.000Z',
        })}
      />,
    );

    expect(
      screen.getByText('Reason given: A photo of one car, not the dealership.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });
});

describe('/admin/portfolio', () => {
  async function page(params: Record<string, string> = {}) {
    return AdminPortfolioPage({ searchParams: Promise.resolve(params) });
  }

  it('reads the pending queue by default, uncached', async () => {
    const queue: AdminPortfolioQueue = { data: [photo()] };
    apiGetParsed.mockResolvedValue(queue);
    render(await page());

    expect(apiGetParsed).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/admin/portfolio?status=PENDING',
      { revalidate: false },
    );
    expect(screen.getByRole('heading', { name: 'Dealer photos' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Photos to review' })).getAllByRole('listitem'),
    ).toHaveLength(1);
  });

  it('forwards the Rejected tab, and ignores a status the queue does not have', async () => {
    apiGetParsed.mockResolvedValue({ data: [] });
    render(await page({ status: 'REJECTED' }));
    expect(apiGetParsed).toHaveBeenLastCalledWith(
      expect.anything(),
      '/v1/admin/portfolio?status=REJECTED',
      { revalidate: false },
    );
    expect(screen.getByText('No rejected photos')).toBeInTheDocument();

    render(await page({ status: 'APPROVED' }));
    expect(apiGetParsed).toHaveBeenLastCalledWith(
      expect.anything(),
      '/v1/admin/portfolio?status=PENDING',
      { revalidate: false },
    );
  });

  it('tells an operator who is not a reviewer so, instead of failing', async () => {
    apiGetParsed.mockRejectedValue(
      new ApiError({
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        code: 'FORBIDDEN',
        detail: 'Only reviewers with portfolio moderation access can decide dealer photographs.',
      }),
    );
    render(await page());

    expect(screen.getByText('You do not have access to photo review')).toBeInTheDocument();
  });
});
