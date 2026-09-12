/**
 * Email behind one narrow port (**R40**).
 *
 * The port is deliberately thin: an address, a subject, two bodies and a tag.
 * No attachments, no CC, no templates, no scheduling — none of which any of the
 * transactional messages need, and every one of which would be a shape a second provider
 * has to be bent into later.
 *
 * ── Where this is called from, and where it is not ──────────────────────────
 * **Only the worker.** No route, no service and no request handler holds a
 * `MailerPort`. The API's contribution to an email is one outbox row written
 * inside the transaction that caused it; everything after that happens in
 * another process. That is the whole architecture of this revision, and it is
 * why this file lives under `platform/` rather than in a module.
 */
export interface MailMessage {
  to: string;
  subject: string;
  /** The message. Both bodies are always sent — see the note in `templates.ts`. */
  html: string;
  text: string;
  /**
   * The template name, for the provider's own dashboard.
   *
   * Resend groups by tag, which turns "are approval emails bouncing" into a
   * filter rather than a support ticket. Never a dealer id: a tag is low
   * cardinality by design and the provider is not a place to put identifiers.
   */
  tag: string;
  /**
   * Passed to the provider as an idempotency key where it supports one.
   *
   * Belt and braces. `notification_deliveries.dedupeKey` is the guarantee that
   * matters, because it is ours and it is a unique index; this is the second
   * line, for the window between claiming a row and the provider answering.
   */
  idempotencyKey: string;
}

export interface MailResult {
  /** The provider's own id, when it gives one. Stored for support questions. */
  providerMessageId: string | null;
}

export interface MailerPort {
  /** For the boot log and the health payload. */
  readonly driver: 'console' | 'resend';
  /**
   * Throws on any failure. The caller — and there is exactly one — turns that
   * into a retry, and eventually into a `FAILED` row somebody can read.
   */
  send(message: MailMessage): Promise<MailResult>;
}
