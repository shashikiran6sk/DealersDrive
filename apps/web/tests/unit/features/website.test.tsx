import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WebsiteActionForm } from '@/features/website/action-form';
import { WebsiteMediaPicker } from '@/features/website/media-picker';
import { WebsiteLink } from '@/features/website/website-link';
import {
  createWebsiteAction,
  saveWebsiteBrandingAction,
  setWebsitePublicationAction,
  websiteDomainAction,
  websiteUploadAction,
} from '@/features/website/actions';
import { apiSend } from '@/lib/api';
import type * as apiModule from '@/lib/api';
import { consoleNavFor } from '@/components/dealer/console-nav';
import { dealerPermissionsFor } from '@dealers-drive/contracts';
import { ConsoleTabBar } from '@/components/dealer/console-nav';

vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof apiModule>()),
  apiSend: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(apiSend).mockReset();
});
describe('My Website real control-plane actions', () => {
  it('validates reservations and refuses injected identity/status fields', async () => {
    const form = new FormData();
    form.set('subdomain', 'www');
    form.set('theme', 'LIGHT');
    expect((await createWebsiteAction({ status: 'idle' }, form)).status).toBe('error');
    expect(apiSend).not.toHaveBeenCalled();
    form.set('subdomain', 'alpha-motors');
    form.set('dealerId', 'other');
    form.set('status', 'ACTIVE');
    vi.mocked(apiSend).mockResolvedValue({});
    expect((await createWebsiteAction({ status: 'idle' }, form)).status).toBe('saved');
    expect(apiSend).toHaveBeenCalledWith('POST', '/v1/dealer/storefront', {
      subdomain: 'alpha-motors',
      theme: 'LIGHT',
    });
  });
  it('saves validated branding/theme/contacts and empty destination selection accurately', async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({
      displayName: 'Alpha Motors',
      theme: 'DARK',
      accentColor: '#155E75',
      headline: 'Our cars',
      contactPhone: '9840012345',
    }))
      form.set(key, value);
    vi.mocked(apiSend).mockResolvedValue({});
    expect((await saveWebsiteBrandingAction({ status: 'idle' }, form)).status).toBe('saved');
    expect(apiSend).toHaveBeenCalledWith(
      'PATCH',
      '/v1/dealer/storefront',
      expect.objectContaining({
        theme: 'DARK',
        contactPhone: '+919840012345',
        accentColor: '#155e75',
      }),
    );
    await setWebsitePublicationAction(
      '11111111-1111-4111-8111-111111111111',
      { status: 'idle' },
      new FormData(),
    );
    expect(apiSend).toHaveBeenLastCalledWith(
      'PUT',
      '/v1/dealer/storefront/publication/11111111-1111-4111-8111-111111111111',
      { marketplacePublished: false, storefrontPublished: false },
    );
  });
  it('validates domain operations and displays backend failures rather than fake success', async () => {
    expect(
      (await websiteDomainAction('invalid', 'primary', { status: 'idle' }, new FormData())).status,
    ).toBe('error');
    vi.mocked(apiSend).mockRejectedValue(new Error('network error'));
    expect(
      (
        await websiteDomainAction(
          '11111111-1111-4111-8111-111111111111',
          'refresh',
          { status: 'idle' },
          new FormData(),
        )
      ).status,
    ).toBe('error');
    expect(
      await websiteUploadAction({ fileName: 'bad.svg', mimeType: 'image/svg+xml', bytes: 100 }),
    ).toHaveProperty('error');
  });
  it('renders real pending/error/save feedback with owner read-only control', async () => {
    const action = vi.fn(() =>
      Promise.resolve({
        status: 'error' as const,
        message: 'The domain is not verified.',
      }),
    );
    const { rerender } = render(
      <WebsiteActionForm action={action} label="Activate" disabled>
        <input name="name" aria-label="Name" />
      </WebsiteActionForm>,
    );
    expect(screen.getByRole('button', { name: 'Activate' })).toBeDisabled();
    rerender(
      <WebsiteActionForm action={action} label="Activate">
        <input name="name" aria-label="Name" />
      </WebsiteActionForm>,
    );
    fireEvent.submit(screen.getByRole('button', { name: 'Activate' }).closest('form')!);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('The domain is not verified.'),
    );
  });
  it('keeps uploaded branding references private and supports explicit removal', async () => {
    const user = userEvent.setup();
    render(
      <WebsiteMediaPicker
        name="heroMediaId"
        label="Hero image"
        initialIds={['11111111-1111-4111-8111-111111111111']}
      />,
    );
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      '/api/website/media/11111111-1111-4111-8111-111111111111/320.webp',
    );
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('input[type=hidden]')).toHaveValue('');
  });
  it('copies only the real website URL and provides accessible feedback', async () => {
    const user = userEvent.setup();
    const copy = vi.fn(() => Promise.resolve(undefined));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: copy },
    });
    render(<WebsiteLink url="https://alpha.example.com" />);
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(copy).toHaveBeenCalledWith('https://alpha.example.com');
    expect(screen.getByRole('status')).toHaveTextContent('Link copied.');
  });
  it('shows My Website to owner/manager and keeps mobile profile/team reachable', () => {
    expect(
      consoleNavFor(dealerPermissionsFor('STAFF')).some((item) => item.label === 'My Website'),
    ).toBe(false);
    expect(
      consoleNavFor(dealerPermissionsFor('MANAGER')).some((item) => item.label === 'My Website'),
    ).toBe(true);
    render(<ConsoleTabBar items={consoleNavFor(dealerPermissionsFor('OWNER'))} />);
    expect(screen.getByText('More')).toBeInTheDocument();
    fireEvent.click(screen.getByText('More'));
    expect(screen.getByRole('link', { name: 'My Website' })).toHaveAttribute(
      'href',
      '/dealer/website',
    );
    expect(screen.getByRole('link', { name: 'Dealer profile' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team' })).toBeInTheDocument();
  });
});
