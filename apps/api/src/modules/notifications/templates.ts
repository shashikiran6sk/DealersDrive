import { env } from '../../config/env.js';

/**
 * Transactional messages, as data (**R40**).
 *
 * ── Why they are functions and not files ────────────────────────────────────
 * These short transactional emails do not need a templating engine, a build step
 * or a directory of `.mjml`. They need to be readable next to the rule that
 * sends them, diffable in a pull request, and impossible to render with an
 * `undefined` in the middle of a sentence — which a typed function gives and a
 * string file does not.
 *
 * ── Both bodies, always ─────────────────────────────────────────────────────
 * Every message carries `text` as well as `html`. Not for taste: a message with
 * no plain-text part scores worse with every spam filter that looks, and the
 * console driver prints the text body — so the part a developer reads while
 * checking a template is the part a filter reads while deciding whether the
 * dealer sees it at all.
 *
 * ── The HTML is deliberately plain ──────────────────────────────────────────
 * Tables, inline styles and a 600px column, because that is what mail clients
 * render. No external stylesheet, no web font, no image: Outlook strips the
 * first two and a third of readers block the third. What survives everywhere is
 * a paragraph, a heading and a link that looks like a button.
 */
export type TemplateName =
  | 'dealer.application.received'
  | 'admin.application.received'
  | 'dealer.application.resubmitted'
  | 'admin.application.resubmitted'
  | 'dealer.application.approved'
  | 'dealer.application.rejected'
  | 'dealer.application.changes-requested'
  | 'dealer.account.suspended'
  | 'dealer.account.reinstated'
  | 'admin.profile-change.submitted'
  | 'dealer.profile-change.approved'
  | 'dealer.profile-change.rejected';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Everything a template may read. Ids are resolved by the worker, never here. */
export interface TemplateContext {
  dealerName: string;
  contactName: string | null;
  /** The moderator's own sentence, verbatim. Never paraphrased. */
  reason?: string | null;
  /** What the dealer proposed, for the two profile-change messages. */
  tagline?: string | null;
  specialities?: string[];
  dealerSlug?: string | null;
}

const CONSOLE = `${env.WEB_BASE_URL}/dealer`;
const ADMIN_QUEUE = `${env.WEB_BASE_URL}/admin/dealers`;

export function render(template: TemplateName, context: TemplateContext): RenderedEmail {
  switch (template) {
    case 'dealer.application.received':
      return compose({
        subject: 'We have your application — Dealers-Drive',
        heading: 'Your application is with us',
        greeting: context.contactName,
        paragraphs: [
          `Thank you for applying to list ${context.dealerName} on Dealers-Drive. We have your business details and your documents.`,
          'A member of our team checks every application by hand — usually within two working days. You do not need to do anything until you hear from us.',
          'If anything is missing or unclear we will write again and tell you exactly what to change.',
        ],
        action: { label: 'View your application', url: CONSOLE },
      });

    case 'admin.application.received':
      return compose({
        subject: `New dealer application — ${context.dealerName}`,
        heading: 'A dealership is waiting for review',
        paragraphs: [
          `${context.dealerName} has submitted an application with documents attached.`,
          'It is in the moderation queue now.',
        ],
        action: { label: 'Open the queue', url: ADMIN_QUEUE },
      });

    case 'dealer.application.resubmitted':
      return compose({
        subject: 'Thanks for resubmitting your application — Dealers-Drive',
        heading: 'Your updated application is with us',
        greeting: context.contactName,
        paragraphs: [
          `Thank you for resubmitting the details for ${context.dealerName}. We have received your updates and the application is back with our review team.`,
          'You do not need to do anything else unless we contact you again.',
        ],
        action: { label: 'View your application', url: CONSOLE },
      });

    case 'admin.application.resubmitted':
      return compose({
        subject: `Dealer application resubmitted — ${context.dealerName}`,
        heading: 'A dealer has resubmitted an application',
        paragraphs: [
          `${context.dealerName} has resubmitted its application after making the requested changes.`,
          'The updated application is back in the moderation queue.',
        ],
        action: { label: 'Review the application', url: ADMIN_QUEUE },
      });

    case 'dealer.application.approved':
      return compose({
        subject: `${context.dealerName} is verified — Dealers-Drive`,
        heading: 'You are verified',
        greeting: context.contactName,
        paragraphs: [
          `${context.dealerName} has been verified and is live on Dealers-Drive. Buyers can find your dealership in the directory and see your page.`,
          'You can start listing cars now. Every listing you publish appears alongside your verified badge.',
        ],
        action: { label: 'Go to your console', url: CONSOLE },
      });

    /*
     * A rejection is the message that most needs to be honest and the least
     * likely to be read twice, so the moderator's reason is the second thing on
     * the page — above the button and below the sentence that says what
     * happened.
     */
    case 'dealer.application.rejected':
      return compose({
        subject: `About your Dealers-Drive application — ${context.dealerName}`,
        heading: 'We could not verify this application',
        greeting: context.contactName,
        paragraphs: [
          `We have reviewed the application for ${context.dealerName} and are not able to verify it.`,
        ],
        quote: context.reason,
        paragraphsAfter: [
          'If you believe this is a mistake, reply to this email and a person will read it.',
        ],
      });

    case 'dealer.application.changes-requested':
      return compose({
        subject: `Something needs changing — ${context.dealerName}`,
        heading: 'We need one more thing',
        greeting: context.contactName,
        paragraphs: [
          `We have looked at the application for ${context.dealerName} and need something changed before we can verify it.`,
        ],
        quote: context.reason,
        paragraphsAfter: [
          'Your application is saved. Open it, make the change, and submit it again — you do not have to start over.',
        ],
        action: { label: 'Open your application', url: CONSOLE },
      });

    case 'dealer.account.suspended':
      return compose({
        subject: `Your dealership has been suspended — ${context.dealerName}`,
        heading: 'Your dealership has been suspended',
        greeting: context.contactName,
        paragraphs: [
          `${context.dealerName} is currently suspended on Dealers-Drive. Its page and vehicle listings are no longer visible to buyers.`,
        ],
        quote: context.reason,
        paragraphsAfter: [
          'If you have questions or believe this is a mistake, reply to this email and our support team will help.',
        ],
      });

    case 'dealer.account.reinstated':
      return compose({
        subject: `Your dealership is active again — ${context.dealerName}`,
        heading: 'Your dealership has been reinstated',
        greeting: context.contactName,
        paragraphs: [
          `${context.dealerName} is active again on Dealers-Drive. Its public page is available to buyers, and previously approved listings can be shown again.`,
        ],
        action: { label: 'Go to your console', url: CONSOLE },
      });

    case 'admin.profile-change.submitted':
      return compose({
        subject: `Profile change to review — ${context.dealerName}`,
        heading: 'A dealership has proposed new public words',
        paragraphs: [
          `${context.dealerName} has proposed a change to what buyers read on its page. Nothing is public until somebody approves it.`,
        ],
        quote: proposalOf(context),
        action: { label: 'Review the change', url: ADMIN_QUEUE },
      });

    case 'dealer.profile-change.approved':
      return compose({
        subject: 'Your profile change is live — Dealers-Drive',
        heading: 'Your change is live',
        greeting: context.contactName,
        paragraphs: [
          `The change you made to the public page for ${context.dealerName} has been approved and buyers can see it now.`,
        ],
        action: { label: 'See your page', url: publicPage(context) },
      });

    case 'dealer.profile-change.rejected':
      return compose({
        subject: 'About your profile change — Dealers-Drive',
        heading: 'We have not published that change',
        greeting: context.contactName,
        paragraphs: [
          `We have read the change you proposed for ${context.dealerName} and have not published it. Your page is unchanged — buyers still see what was there before.`,
        ],
        quote: context.reason,
        paragraphsAfter: [
          'You can write something different from your profile screen at any time.',
        ],
        action: { label: 'Open your profile', url: `${CONSOLE}/profile` },
      });
  }
}

function publicPage(context: TemplateContext): string {
  return context.dealerSlug ? `${env.WEB_BASE_URL}/dealers/${context.dealerSlug}` : CONSOLE;
}

/** The tagline and the services, as one readable block. */
function proposalOf(context: TemplateContext): string | null {
  const lines: string[] = [];
  if (context.tagline) lines.push(context.tagline);
  if (context.specialities && context.specialities.length > 0) {
    lines.push(`Services: ${context.specialities.join(', ')}`);
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

interface Composition {
  subject: string;
  heading: string;
  greeting?: string | null;
  paragraphs: string[];
  /** A moderator's sentence, or a dealer's proposal. Rendered as a quoted block. */
  quote?: string | null;
  paragraphsAfter?: string[];
  action?: { label: string; url: string };
}

/**
 * One shape for every template, so a new message cannot arrive with a different
 * footer, a different width or a missing plain-text body.
 *
 * `escape` runs over every interpolated value without exception. None of them
 * is attacker-controlled *today* — they are dealership names and moderator
 * notes — but a dealership name is typed by a dealer, and "no user input
 * reaches this template" is a property that stops being true the first time
 * somebody adds a field.
 */
function compose(parts: Composition): RenderedEmail {
  const before = parts.paragraphs;
  const after = parts.paragraphsAfter ?? [];
  const hello = parts.greeting ? `Hi ${parts.greeting},` : null;

  const textLines = [
    parts.heading,
    '',
    ...(hello ? [hello, ''] : []),
    ...before.flatMap((line) => [line, '']),
    ...(parts.quote ? [indent(parts.quote), ''] : []),
    ...after.flatMap((line) => [line, '']),
    ...(parts.action ? [`${parts.action.label}: ${parts.action.url}`, ''] : []),
    '—',
    'Dealers-Drive',
    `Questions? ${env.SUPPORT_EMAIL}`,
  ];

  const htmlBody = [
    `<h1 style="margin:0 0 18px;font-size:22px;line-height:1.25;color:#0d1017;">${escape(parts.heading)}</h1>`,
    ...(hello ? [paragraph(hello)] : []),
    ...before.map((line) => paragraph(line)),
    ...(parts.quote ? [quote(parts.quote)] : []),
    ...after.map((line) => paragraph(line)),
    ...(parts.action ? [button(parts.action.label, parts.action.url)] : []),
  ].join('\n');

  return {
    subject: parts.subject,
    text: textLines.join('\n').trimEnd(),
    html: shell(parts.subject, htmlBody),
  };
}

function paragraph(value: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#2b3038;">${escape(value)}</p>`;
}

/** A moderator's own words, set apart so they are not mistaken for ours. */
function quote(value: string): string {
  return (
    `<blockquote style="margin:0 0 16px;padding:12px 14px;border-left:3px solid #2f55dd;` +
    `background:#f4f5f7;font-size:15px;line-height:1.55;color:#2b3038;white-space:pre-wrap;">` +
    `${escape(value)}</blockquote>`
  );
}

/**
 * A table, not an `<a class="btn">`. Outlook renders the anchor as unstyled
 * text; a single-cell table with a background is the shape that survives every
 * client, and it is why transactional email still looks like 2005 HTML.
 */
function button(label: string, url: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 4px;">` +
    `<tr><td style="background:#2f55dd;">` +
    `<a href="${escape(url)}" style="display:inline-block;padding:11px 20px;font-size:15px;` +
    `font-weight:600;color:#ffffff;text-decoration:none;">${escape(label)}</a>` +
    `</td></tr></table>`
  );
}

function shell(title: string, body: string): string {
  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${escape(title)}</title></head>`,
    '<body style="margin:0;padding:0;background:#f4f5f7;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;">',
    '<tr><td align="center" style="padding:28px 16px;">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" ' +
      'style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e3e6ea;">',
    '<tr><td style="padding:26px 28px 8px;font-family:-apple-system,BlinkMacSystemFont,' +
      "'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">",
    '<div style="font-size:15px;font-weight:700;color:#0d1017;margin:0 0 20px;">Dealers-Drive</div>',
    body,
    '</td></tr>',
    '<tr><td style="padding:18px 28px 26px;border-top:1px solid #e3e6ea;' +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;" +
      'font-size:12px;line-height:1.5;color:#6b7280;">',
    `Dealers-Drive verifies dealer identity and business documents. Every vehicle is owned, priced and warranted by the dealer who lists it.<br>Questions? <a href="mailto:${escape(env.SUPPORT_EMAIL)}" style="color:#2f55dd;">${escape(env.SUPPORT_EMAIL)}</a>`,
    '</td></tr></table></td></tr></table></body></html>',
  ].join('\n');
}

/** Two spaces, so a quoted note is visibly not the sentence around it. */
function indent(value: string): string {
  return value
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
