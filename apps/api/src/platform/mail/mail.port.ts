export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  tag: string;
  idempotencyKey: string;
}

export interface MailResult {
  providerMessageId: string | null;
}

export interface MailerPort {
  readonly driver: 'console' | 'resend';
  send(message: MailMessage): Promise<MailResult>;
}
