import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ApiModule from '@/lib/api';
import type * as PublicConfigModule from '@/lib/public-config';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiGet: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  currentSession: vi.fn(() => Promise.resolve(null)),
  destinationFor: () => '/dealer',
}));

const whatsappSwitch = vi.hoisted(() => ({ on: false }));

vi.mock('@/lib/public-config', async (importOriginal) => {
  const actual = await importOriginal<typeof PublicConfigModule>();
  return {
    ...actual,
    getPublicConfig: vi.fn(() =>
      Promise.resolve({ ...actual.NO_PUBLIC_CONFIG, whatsappOtpEnabled: whatsappSwitch.on }),
    ),
  };
});

vi.mock('@/features/auth/sign-in-actions', () => ({
  customerPhoneSignInAction: vi.fn(),
  customerSignUpAction: vi.fn(),
  dealerPhoneSignInAction: vi.fn(),
}));

/**
 * `/login` and the old `/dealer/login` (**R63**) — what the server decides
 * before anything renders: which tab opens, and where a sign-in may send
 * somebody afterwards.
 */
async function page(params: Record<string, string>) {
  const { apiGet } = await import('@/lib/api');
  vi.mocked(apiGet).mockImplementation((path: string) =>
    Promise.resolve(
      path === '/v1/auth/providers'
        ? {
            google: {
              enabled: true,
              startUrl: 'http://api.test/v1/auth/google/start',
              adminStartUrl: '',
              linkStartUrl: '',
              reason: null,
            },
          }
        : {
            enabled: true,
            driver: 'fake',
            widgetId: null,
            tokenAuth: null,
            devCode: '123456',
            reason: null,
          },
    ),
  );
  const { default: LoginPage } = await import('@/app/(auth)/login/page');
  render(await LoginPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.resetModules();
  whatsappSwitch.on = false;
});

function whatsappLogos(): Element[] {
  return Array.from(document.querySelectorAll('[data-slot="whatsapp-icon"]'));
}

describe('/login — the WhatsApp OTP switch', () => {
  it('shows the WhatsApp logo on the customer OTP button when the switch is on', async () => {
    whatsappSwitch.on = true;
    await page({});

    const send = screen.getByRole('button', { name: 'Send OTP on WhatsApp' });
    expect(send.querySelector('[data-slot="whatsapp-icon"] svg')).not.toBeNull();
  });

  it('shows no WhatsApp logo when the switch is off', async () => {
    await page({});

    expect(screen.getAllByRole('button', { name: 'Send OTP' }).length).toBeGreaterThan(0);
    expect(whatsappLogos()).toEqual([]);
  });

  it('carries the switch to the dealer tab as well', async () => {
    whatsappSwitch.on = true;
    await page({ as: 'dealer' });

    expect(whatsappLogos()).toHaveLength(2);
  });
});

describe('/login', () => {
  it('opens on Customer, under one Login heading', async () => {
    await page({});
    expect(screen.getByRole('heading', { level: 1, name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Customer' })).toHaveAttribute('aria-selected', 'true');
  });

  it('links a buyer or dealer who is stuck to the Contact & support page', async () => {
    await page({});
    expect(screen.getByRole('link', { name: /trouble signing in/i })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  it('opens on Dealer when asked', async () => {
    await page({ as: 'dealer' });
    expect(screen.getByRole('tab', { name: 'Dealer' })).toHaveAttribute('aria-selected', 'true');
  });

  it('carries a safe dealer path to Google', async () => {
    await page({ as: 'dealer', returnTo: '/dealer/inventory' });
    expect(screen.getByRole('link', { name: /continue with google/i })).toHaveAttribute(
      'href',
      'http://api.test/v1/auth/google/start?returnTo=%2Fdealer%2Finventory',
    );
  });

  it.each(['https://evil.example', '//evil.example', '/\\evil.example'])(
    'does not carry %j anywhere',
    async (returnTo) => {
      await page({ as: 'dealer', returnTo });
      expect(screen.getByRole('link', { name: /continue with google/i })).toHaveAttribute(
        'href',
        'http://api.test/v1/auth/google/start?returnTo=%2Fdealer',
      );
    },
  );
});

describe('/dealer/login', () => {
  async function redirectOf(params: Record<string, string>): Promise<string> {
    const { default: DealerLoginPage } = await import('@/app/(auth)/dealer/login/page');
    try {
      await DealerLoginPage({ searchParams: Promise.resolve(params) });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.startsWith('NEXT_REDIRECT:')) return message.slice('NEXT_REDIRECT:'.length);
      throw error;
    }
    throw new Error('expected a redirect');
  }

  it('opens the Dealer tab of the unified login', async () => {
    expect(await redirectOf({})).toBe('/login?as=dealer');
  });

  /** Google's callback still sends failures here; the message must survive the hop. */
  it('keeps the error and the return path, and nothing else', async () => {
    expect(
      await redirectOf({ error: 'account_suspended', returnTo: '/dealer/inventory', extra: 'x' }),
    ).toBe('/login?as=dealer&error=account_suspended&returnTo=%2Fdealer%2Finventory');
  });
});
