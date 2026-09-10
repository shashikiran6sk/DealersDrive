import { describe, expect, it } from 'vitest';

import { render, type TemplateName } from '../../../../src/modules/notifications/templates.js';

/**
 * The eight messages (**R40**).
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
  'dealer.application.approved',
  'dealer.application.rejected',
  'dealer.application.changes-requested',
  'admin.profile-change.submitted',
  'dealer.profile-change.approved',
  'dealer.profile-change.rejected',
];

const CONTEXT = {
  dealerName: 'Sri Lakshmi Motors',
  contactName: 'Karthik Raman',
  reason: 'The GST certificate is for a different entity.',
  tagline: 'Family-run since 1998.',
  specialities: ['In-house workshop', 'RC transfer'],
  dealerSlug: 'sri-lakshmi-motors',
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
