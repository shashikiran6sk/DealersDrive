import { describe, expect, it } from 'vitest';

import { render, type TemplateName } from '../../../../src/modules/notifications/templates.js';

/**
 * The transactional messages (**R40**).
 *
 * What is worth pinning here is not the wording — that will change, and a test
 * that fails when somebody improves a sentence is a tax. It is the three things
 * a template can get wrong silently:
 *
 *   · **an `undefined` in the middle of a sentence**, which is invisible in
 *     rendered HTML and is what a dealer actually receives;
 *   · **a missing plain-text body**, which costs deliverability with every
 *     spam filter that looks;
 *   · **an unescaped value**, because a dealership name is typed by a dealer.
 */
const ALL: TemplateName[] = [
  'dealer.application.received',
  'admin.application.received',
  'dealer.application.resubmitted',
  'admin.application.resubmitted',
  'dealer.application.approved',
  'dealer.application.rejected',
  'dealer.application.changes-requested',
  'dealer.application.closed',
  'dealer.account.suspended',
  'dealer.account.reinstated',
  'admin.profile-change.submitted',
  'dealer.profile-change.approved',
  'dealer.profile-change.rejected',
  'dealer.email.verify',
  'admin.listing.submitted',
  'admin.listing.resubmitted',
  'dealer.listing.approved',
  'dealer.listing.rejected',
  'dealer.listing.changes-requested',
  'admin.listing.reactivation-requested',
  'dealer.listing.reactivation-approved',
  'dealer.listing.reactivation-rejected',
  'dealer.enquiry.received',
  'admin.support.ticket-created',
  'customer.support.ticket-received',
  'customer.support.ticket-status',
];

const CONTEXT = {
  dealerName: 'Sri Lakshmi Motors',
  contactName: 'Karthik Raman',
  reason: 'The GST certificate is for a different entity.',
  tagline: 'Family-run since 1998.',
  specialities: ['In-house workshop', 'RC transfer'],
  dealerSlug: 'sri-lakshmi-motors',
  actionUrl: 'https://dealers-drive.test/claim/abc',
  expiresAt: new Date('2026-10-09T10:00:00.000Z'),
  listing: {
    id: '33333333-3333-4333-8333-333333333333',
    vehicleId: '22222222-2222-4222-8222-222222222222',
    slug: '2022-hyundai-creta-vellore-abc123',
    title: '2022 Hyundai Creta SX',
    plate: 'TN 23 AB 1234',
  },
  enquiry: { buyerName: 'Asha', message: 'Is the price negotiable?' },
  ticket: {
    id: '44444444-4444-4444-8444-444444444444',
    reference: 'DD-1042',
    subject: 'The dealer has not called me back',
    category: 'DEALER_ISSUE' as const,
    status: 'WAITING_FOR_CUSTOMER' as const,
  },
};

describe('every template', () => {
  it.each(ALL)('%s renders both bodies and names the dealership', (template) => {
    const email = render(template, CONTEXT);

    expect(email.subject).not.toBe('');
    expect(email.html).toContain('<!doctype html>');
    expect(email.text.length).toBeGreaterThan(40);
    // The failure this catches: a context field renamed on one side only.
    expect(`${email.subject} ${email.html} ${email.text}`).not.toMatch(
      /undefined|null|NaN|\[object/,
    );
  });

  /** A dealership with nothing optional answered still renders a sentence. */
  it.each(ALL)('%s survives an empty context', (template) => {
    const email = render(template, {
      dealerName: 'Sri Lakshmi Motors',
      contactName: null,
      reason: null,
      tagline: null,
      specialities: [],
      dealerSlug: null,
    });

    expect(email.text).not.toMatch(/undefined|null/);
    expect(email.html).not.toMatch(/undefined|null/);
    // No name, no greeting — rather than "Hi ,".
    expect(email.text).not.toContain('Hi ,');
  });

  it.each(ALL)('%s links somewhere absolute', (template) => {
    const email = render(template, CONTEXT);

    // A relative link in an email goes nowhere: there is no page it is
    // relative to.
    expect(email.html).not.toMatch(/href="\/[^/]/);
  });
});

describe('the moderator’s own words', () => {
  /**
   * A rejection is the message most in need of being honest and least likely to
   * be read twice, so the reason is quoted verbatim rather than paraphrased.
   */
  it.each([
    ['dealer.application.rejected'],
    ['dealer.application.changes-requested'],
    ['dealer.account.suspended'],
    ['dealer.profile-change.rejected'],
  ] as [TemplateName][])('%s carries the reason verbatim', (template) => {
    const email = render(template, CONTEXT);

    expect(email.text).toContain('The GST certificate is for a different entity.');
    expect(email.html).toContain('The GST certificate is for a different entity.');
  });

  /** And a decision with no reason attached does not render an empty quote. */
  it('renders no quote block when there is no reason', () => {
    const email = render('dealer.application.rejected', { ...CONTEXT, reason: null });

    expect(email.html).not.toContain('<blockquote');
  });
});

describe('application resubmission', () => {
  it('thanks the dealer for resubmitting the details', () => {
    const email = render('dealer.application.resubmitted', CONTEXT);

    expect(email.subject).toContain('Thanks for resubmitting');
    expect(email.text).toContain('Thank you for resubmitting the details');
  });

  it('tells the admin that the dealer resubmitted the application', () => {
    const email = render('admin.application.resubmitted', CONTEXT);

    expect(email.subject).toContain('application resubmitted');
    expect(email.text).toContain('has resubmitted its application');
  });
});

describe('escaping', () => {
  /**
   * None of these values is attacker-controlled *today* — they are dealership
   * names and moderator notes. A dealership name is typed by a dealer, though,
   * and "no user input reaches this template" is a property that stops being
   * true the first time somebody adds a field.
   */
  it('escapes a dealership name that contains markup', () => {
    const email = render('dealer.application.approved', {
      ...CONTEXT,
      dealerName: '<script>alert(1)</script> Motors',
    });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });

  it('escapes a moderator’s note that contains markup', () => {
    const email = render('dealer.application.rejected', {
      ...CONTEXT,
      reason: 'Try <b>again</b> with "the right" document',
    });

    expect(email.html).not.toContain('<b>again</b>');
    expect(email.html).toContain('&lt;b&gt;');
    expect(email.html).toContain('&quot;');
  });
});

describe('the profile-change review email', () => {
  it('shows the moderator what was proposed', () => {
    const email = render('admin.profile-change.submitted', CONTEXT);

    expect(email.text).toContain('Family-run since 1998.');
    expect(email.text).toContain('In-house workshop, RC transfer');
  });

  it('shows the services alone when only they changed', () => {
    const email = render('admin.profile-change.submitted', { ...CONTEXT, tagline: null });

    expect(email.text).toContain('In-house workshop');
    expect(email.html).not.toMatch(/undefined/);
  });
});

describe('the approved message', () => {
  it('links the dealership’s own public page', () => {
    const email = render('dealer.profile-change.approved', CONTEXT);

    expect(email.html).toContain('/dealers/sri-lakshmi-motors');
  });

  /** A dealership with no slug still gets a working button. */
  it('falls back to the console when there is no slug', () => {
    const email = render('dealer.profile-change.approved', { ...CONTEXT, dealerSlug: null });

    expect(email.html).not.toContain('/dealers/null');
    expect(email.html).toContain('/dealer');
  });
});

describe('the listing emails (R116)', () => {
  it('name the car by title and plate, and link where the reader acts', () => {
    const submitted = render('admin.listing.submitted', CONTEXT);
    expect(submitted.subject).toContain('2022 Hyundai Creta SX (TN 23 AB 1234)');
    expect(submitted.text).toContain('/admin/listings/33333333-3333-4333-8333-333333333333');

    const live = render('dealer.listing.approved', CONTEXT);
    expect(live.text).toContain('/car/2022-hyundai-creta-vellore-abc123');

    const changes = render('dealer.listing.changes-requested', CONTEXT);
    expect(changes.text).toContain(
      '/dealer/vehicles/22222222-2222-4222-8222-222222222222/edit?step=review',
    );
    expect(changes.text).toContain(CONTEXT.reason);

    const reactivation = render('admin.listing.reactivation-requested', CONTEXT);
    expect(reactivation.text).toContain('/admin/listings?view=reactivation');
  });

  it('fall back to the inventory when the listing is gone or unpublished', () => {
    const email = render('dealer.listing.approved', {
      dealerName: 'Sri Lakshmi Motors',
      contactName: null,
    });
    expect(email.text).toContain('/dealer/inventory');
    expect(email.text).toContain('your car');
  });
});

describe('the enquiry and support emails (R117)', () => {
  it('tell the dealer who asked, and send them to the inbox for the number', () => {
    const email = render('dealer.enquiry.received', CONTEXT);
    expect(email.subject).toBe('New enquiry — 2022 Hyundai Creta SX');
    expect(email.text).toContain('Asha has enquired about 2022 Hyundai Creta SX (TN 23 AB 1234)');
    expect(email.text).toContain('Is the price negotiable?');
    expect(email.text).toContain('/dealer/enquiries');
  });

  it('keep the customer’s own words out of every subject line', () => {
    for (const template of [
      'admin.support.ticket-created',
      'customer.support.ticket-received',
      'customer.support.ticket-status',
    ] as const) {
      const email = render(template, CONTEXT);
      expect(email.subject).toContain('DD-1042');
      expect(email.subject).not.toContain('called me back');
      expect(email.text).toContain('called me back');
    }
  });

  it('say the status in the customer’s words, and link to their request', () => {
    const email = render('customer.support.ticket-status', CONTEXT);
    expect(email.subject).toBe('DD-1042: Awaiting your reply — Dealers-Drive');
    expect(email.text).toContain('/support-requests/44444444-4444-4444-8444-444444444444');
    expect(render('admin.support.ticket-created', CONTEXT).text).toContain(
      '/admin/support/44444444-4444-4444-8444-444444444444',
    );
  });
});
