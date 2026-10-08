import { LEGAL_DOCUMENTS, LEGAL_VERSION } from '@dealers-drive/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LegalCheck } from '@/features/legal/legal-check';
import { LegalDocument } from '@/features/legal/legal-document';
import { LegalProvider } from '@/features/legal/legal-provider';
import { CustomerNameStep } from '@/features/auth/login/customer-name-step';
import { EnquiryForm } from '@/features/enquiry/enquiry-panel/enquiry-form';
import { customerSignUpAction } from '@/features/auth/sign-in-actions';
import { legalEnforcementEnabled, legalPagesVisible } from '@/lib/legal-release';
import {
  accountAgreement,
  dealerAgreement,
  listingDeclaration,
} from '@/features/legal/legal-form-input';
import { legalMetadata } from '@/features/legal/legal-metadata';

vi.mock('@/features/auth/sign-in-actions', () => ({ customerSignUpAction: vi.fn() }));
beforeEach(() => {
  vi.mocked(customerSignUpAction).mockReset();
  vi.unstubAllEnvs();
});

describe('document pages', () => {
  it.each(Object.values(LEGAL_DOCUMENTS))(
    'renders $title with numbered clauses and working contents links',
    (document) => {
      const { container } = render(<LegalDocument documentId={document.id} />);
      expect(screen.getByRole('heading', { level: 1, name: document.title })).toBeInTheDocument();
      expect(screen.getByText(/Draft for review/)).toBeInTheDocument();
      expect(container.querySelectorAll('section')).toHaveLength(document.sections.length);
      const contents = screen.getByRole('navigation', { name: 'On this page' });
      for (const anchor of contents.querySelectorAll('a[href^="#"]'))
        expect(container.querySelector(anchor.getAttribute('href') ?? '')).not.toBeNull();
      expect(screen.getByRole('link', { name: 'Permanent version link' })).toHaveAttribute(
        'href',
        `/legal/${document.id}/${document.version}`,
      );
      expect(legalMetadata(document.id).robots).toMatchObject({ index: false });
    },
  );
  it('blocks public production drafts and accidental activation, including Vercel production', () => {
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('LEGAL_ENFORCEMENT_ENABLED', 'true');
    expect(legalPagesVisible()).toBe(false);
    expect(() => legalEnforcementEnabled()).toThrow(/blocked/);
    vi.stubEnv('APP_ENV', 'preview');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(legalPagesVisible()).toBe(false);
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(legalPagesVisible()).toBe(true);
    expect(legalEnforcementEnabled()).toBe(true);
  });
  it('labels permanent snapshots as archived', () => {
    render(<LegalDocument documentId="terms" archived />);
    expect(screen.getByText(/Archived snapshot/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read the current version' })).toHaveAttribute(
      'href',
      '/terms',
    );
  });
});

describe('explicit accessible choices', () => {
  it('starts unticked, keeps acknowledgement separate, and supports keyboard choice', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(
      <LegalProvider enabled>
        <LegalCheck kind="dealer" onCompleteChange={changed} />
      </LegalProvider>,
    );
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    for (const box of boxes) {
      expect(box).not.toBeChecked();
      expect(box).toBeRequired();
    }
    boxes[0]?.focus();
    await user.keyboard(' ');
    expect(boxes[0]).toBeChecked();
    expect(changed).toHaveBeenLastCalledWith(false);
    await user.click(boxes[1]!);
    await user.click(boxes[2]!);
    expect(changed).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('link', { name: /Privacy Policy/ })).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(screen.getByText(/not permission for unrelated marketing/)).toBeInTheDocument();
    await user.click(boxes[0]!);
    expect(changed).toHaveBeenLastCalledWith(false);
  });
  it('does not add agreement collection when deployment collection is disabled', () => {
    render(
      <LegalProvider enabled={false}>
        <LegalCheck kind="account" />
      </LegalProvider>,
    );
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
  it('refuses a customer account with incomplete choices, even with noValidate', async () => {
    const user = userEvent.setup();
    vi.mocked(customerSignUpAction).mockResolvedValue({ done: true });
    const created = vi.fn();
    render(
      <LegalProvider enabled>
        <CustomerNameStep phoneDisplay="+91 98987 10001" onCreated={created} onRestart={vi.fn()} />
      </LegalProvider>,
    );
    await user.type(screen.getByRole('textbox'), 'Fixture Buyer');
    await user.click(screen.getByRole('button', { name: /Create account/i }));
    expect(customerSignUpAction).not.toHaveBeenCalled();
    for (const box of screen.getAllByRole('checkbox')) await user.click(box);
    await user.click(screen.getByRole('button', { name: /Create account/i }));
    await waitFor(() => expect(created).toHaveBeenCalledOnce());
    expect(customerSignUpAction).toHaveBeenCalledWith('Fixture Buyer', {
      version: LEGAL_VERSION,
      accepted: true,
      privacyAcknowledged: true,
    });
  });
  it('does not send an enquiry until the named dealer sharing choice is made', async () => {
    const user = userEvent.setup();
    const send = vi.fn().mockResolvedValue({ status: 'invalid', message: 'Fixture response' });
    render(
      <LegalProvider enabled>
        <EnquiryForm
          customer={{ fullName: 'Fixture Buyer', phoneDisplay: '+91 98987 10001' }}
          dealerName="Fixture Motors"
          onSend={send}
          onCancel={vi.fn()}
        />
      </LegalProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Choose whether/);
    await user.click(screen.getByRole('checkbox', { name: /Fixture Motors/ }));
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith('', { version: LEGAL_VERSION, granted: true }),
    );
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
  it('validates actual submitted form choices and preserves the displayed version', () => {
    const form = new FormData();
    expect(accountAgreement(form).success).toBe(false);
    form.set('legalVersion', 'displayed-version');
    form.set('termsAccepted', 'true');
    expect(accountAgreement(form).success).toBe(false);
    form.set('privacyAcknowledged', 'true');
    expect(accountAgreement(form).data?.version).toBe('displayed-version');
    expect(dealerAgreement(form).success).toBe(false);
    form.set('authorityConfirmed', 'true');
    expect(dealerAgreement(form).success).toBe(true);
    expect(listingDeclaration(form).success).toBe(false);
    form.set('certified', 'true');
    expect(listingDeclaration(form).data?.certification?.version).toBe('displayed-version');
    form.delete('certified');
    expect(listingDeclaration(form).success).toBe(false);
  });
});
