import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEGAL_CHECKBOX_TEXT,
  TERMS_V1,
  PRIVACY_V1,
  type AuthSession,
} from '@dealers-drive/contracts';

import type * as ApiModule from '@/lib/api';

import { cookieJar } from '../setup';
import { LegalCheck } from '@/components/forms/legal-check';
import { LegalDocument } from '@/components/layout/legal-document';
import { LegalGate } from '@/features/legal/legal-gate';
import { acceptLegalAction } from '@/features/legal/actions';
import { ReviewStep } from '@/features/auth/onboarding-wizard/review-step';
import { legalStatus, requireCustomerLegal } from '@/lib/legal';
import { buildSitemap } from '@/lib/seo/sitemap';
import TermsPage, { generateMetadata as termsMetadata } from '@/app/(public)/terms/page';
import PrivacyPage, { generateMetadata as privacyMetadata } from '@/app/(public)/privacy/page';
import LoginPage from '@/app/(auth)/login/page';
import DealerLayout from '@/app/(dealer)/dealer/layout';
import OnboardingPage from '@/app/(auth)/dealer/onboarding/page';
import { ApiError } from '@/lib/api';

const api = vi.hoisted(() => ({
  send: vi.fn(),
  parsed: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  get: vi.fn(),
  customer: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiSend: api.send,
  apiGet: api.get,
  apiGetParsed: (...args: unknown[]) =>
    args[1] === '/v1/auth/customer/me' ? api.customer(...args) : api.parsed(...args),
}));

beforeEach(() => {
  api.customer.mockResolvedValue({
    customer: {
      id: '00000000-0000-4000-8000-000000000001',
      fullName: 'Verified Customer',
      phone: '+919840012345',
      phoneDisplay: '+91 98400 12345',
    },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const session = { dealer: { status: 'DRAFT' } } as AuthSession;
const enabled = () => {
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('LEGAL_V1_PREVIEW', 'true');
  cookieJar.set('dd_session', 'test-session');
};
const status = (accepted = false, canAccept = true) => ({
  enabled: true,
  accepted,
  canAccept,
  termsVersion: 'terms-v1.0',
  privacyVersion: 'privacy-v1.0',
});

function mockLoginProviders(): void {
  api.get.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/v1/auth/providers'
        ? {
            google: {
              enabled: true,
              startUrl: '/v1/auth/google/start',
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
}

describe('one-line affirmative checkbox', () => {
  it('is unchecked, required, named by the exact sentence, and has two independent policy links', async () => {
    render(<LegalCheck />);
    const checkbox = screen.getByRole('checkbox', { name: LEGAL_CHECKBOX_TEXT });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toBeRequired();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    for (const [name, href] of [
      ['Terms & Conditions', '/terms'],
      ['Privacy Policy', '/privacy'],
    ]) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });
  it('appears only when dealer review requires it and leaves a submitted application alone', () => {
    const { rerender } = render(<ReviewStep session={session} completeness={null} legalRequired />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    rerender(<ReviewStep session={session} completeness={null} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    rerender(
      <ReviewStep
        session={{ ...session, dealer: { ...session.dealer!, status: 'PENDING_APPROVAL' } }}
        completeness={null}
        legalRequired
      />,
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
  it('never presents an owner-agreement checkbox to a member without authority', () => {
    render(<LegalGate scope="DEALER" returnTo="/dealer" canAccept={false} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/owner must sign in/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact & Support' })).toHaveAttribute(
      'href',
      '/contact',
    );
  });
});

describe('server actions and one-time routing', () => {
  it('refuses unchecked acceptance before making any backend request', async () => {
    expect(await acceptLegalAction('CUSTOMER', '/', {}, new FormData())).toEqual({
      message: 'Select the checkbox to continue.',
    });
    expect(api.send).not.toHaveBeenCalled();
  });
  it('sends only affirmative acceptance and scope, then continues to the safe destination', async () => {
    const form = new FormData();
    form.set('accepted', 'true');
    form.set('userId', 'forged');
    api.send.mockResolvedValue(status(true));
    await expect(acceptLegalAction('CUSTOMER', '/saved', {}, form)).rejects.toThrow(
      'NEXT_REDIRECT:/saved',
    );
    expect(api.send).toHaveBeenCalledWith('POST', '/v1/legal/accept', {
      scope: 'CUSTOMER',
      accepted: true,
    });
    await expect(
      acceptLegalAction('DEALER', 'https://untrusted.example', {}, form),
    ).rejects.toThrow('NEXT_REDIRECT:/dealer');
  });
  it('uses an uncached authenticated status and gates private customer entries', async () => {
    enabled();
    api.parsed.mockResolvedValue(status());
    expect(await legalStatus('CUSTOMER')).toEqual(status());
    expect(api.parsed).toHaveBeenCalledWith(expect.anything(), '/v1/legal/status?scope=CUSTOMER', {
      revalidate: false,
    });
    await expect(requireCustomerLegal('/saved')).rejects.toThrow(
      'NEXT_REDIRECT:/login?returnTo=%2Fsaved',
    );
    api.parsed.mockResolvedValue(status(true));
    await expect(requireCustomerLegal('/saved')).resolves.toBeUndefined();
  });
  it('shows the customer gate after authentication and skips it on every later login entry', async () => {
    enabled();
    api.parsed.mockResolvedValue(status());
    render(await LoginPage({ searchParams: Promise.resolve({ returnTo: '/saved' }) }));
    expect(screen.getByRole('checkbox', { name: LEGAL_CHECKBOX_TEXT })).not.toBeChecked();
    api.parsed.mockResolvedValue(status(true));
    await expect(
      LoginPage({ searchParams: Promise.resolve({ returnTo: '/saved' }) }),
    ).rejects.toThrow('NEXT_REDIRECT:/saved');
  });
  it('keeps a direct login visit on the form after the policies were already accepted', async () => {
    enabled();
    api.parsed.mockResolvedValue(status(true));
    mockLoginProviders();

    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('tab', { name: 'Customer' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Dealer' }));
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toBeInTheDocument();
  });
  it.each([
    { accepted: false, returnTo: undefined },
    { accepted: true, returnTo: undefined },
    { accepted: false, returnTo: '/saved' },
    { accepted: true, returnTo: '/saved' },
  ])(
    'keeps customer phone sign-in accessible for a Google-only dealer ($accepted, $returnTo)',
    async ({ accepted, returnTo }) => {
      enabled();
      cookieJar.set('dd_session', 'google-dealer-session');
      api.customer.mockRejectedValue(
        new ApiError({
          type: 'about:blank',
          title: 'Not authenticated as a customer',
          status: 401,
          code: 'NOT_AUTHENTICATED',
        }),
      );
      api.parsed.mockResolvedValue(status(accepted));
      mockLoginProviders();

      render(await LoginPage({ searchParams: Promise.resolve({ returnTo }) }));

      expect(screen.getByRole('tab', { name: 'Customer' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('textbox', { name: /mobile number/i })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: LEGAL_CHECKBOX_TEXT })).toBeNull();
      expect(api.parsed).not.toHaveBeenCalled();
      expect(cookieJar.get('dd_session')).toBe('google-dealer-session');
    },
  );
  it('shows approved dealers a small gate before fetching normal console data', async () => {
    api.get.mockResolvedValue({ next: 'DASHBOARD' });
    enabled();
    api.parsed.mockResolvedValue(status());
    render(await DealerLayout({ children: <p>Console contents</p> }));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.queryByText('Console contents')).not.toBeInTheDocument();
  });
});

describe('dealer acceptance before documents', () => {
  it.each(['DRAFT', 'PENDING_APPROVAL'])(
    'lets a %s owner agree without loading document prerequisites',
    async (dealerStatus) => {
      enabled();
      api.get.mockResolvedValue({ dealer: { status: dealerStatus } });
      api.parsed.mockResolvedValue(status());
      render(await OnboardingPage({ searchParams: Promise.resolve({ step: '3' }) }));
      expect(screen.getByRole('checkbox', { name: LEGAL_CHECKBOX_TEXT })).not.toBeChecked();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
      expect(api.get).toHaveBeenCalledTimes(1);
      expect(api.get).toHaveBeenCalledWith('/v1/auth/me', { revalidate: false });
    },
  );
});

describe('two public legal documents', () => {
  it.each([TERMS_V1, PRIVACY_V1])(
    'renders $title with version, semantic headings and effective-date status without a session',
    (document) => {
      render(<LegalDocument document={document} />);
      expect(screen.getByRole('article')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: document.title })).toBeInTheDocument();
      expect(screen.getByText(document.version)).toBeInTheDocument();
      expect(screen.getByText(/Effective date:/)).toHaveTextContent('2026-10-24');
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(
        document.sections.length + 1,
      );
    },
  );
  it('has canonical metadata and two unauthenticated preview routes', () => {
    vi.stubEnv('APP_ENV', 'local');
    expect(TermsPage()).toBeTruthy();
    expect(PrivacyPage()).toBeTruthy();
    expect(termsMetadata().alternates?.canonical).toMatch(/\/terms$/);
    expect(privacyMetadata().alternates?.canonical).toMatch(/\/privacy$/);
    expect(termsMetadata().description).toBe(TERMS_V1.description);
    const urls = buildSitemap(
      { vehicles: [], dealers: [] },
      { districts: [], total: 0, cars: { total: 0, districts: {} } },
    ).map((row) => row.url);
    expect(urls.some((url) => url.endsWith('/terms'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/privacy'))).toBe(true);
  });
  it('publishes the two policies with confirmed business details in production without requiring a session', async () => {
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('LEGAL_V1_PREVIEW', 'true');
    expect(TermsPage()).toBeTruthy();
    expect(PrivacyPage()).toBeTruthy();
    expect(await legalStatus('CUSTOMER')).toBeNull();
    expect(api.parsed).not.toHaveBeenCalled();
  });
});
