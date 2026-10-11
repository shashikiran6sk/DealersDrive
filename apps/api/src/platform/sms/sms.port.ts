export interface SmsMessage {
  to: string;
  templateId: string;
  variables: Record<string, string>;
  tag: string;
  idempotencyKey: string;
}

export interface SmsResult {
  providerMessageId: string | null;
}

export interface SmsPort {
  readonly driver: 'console' | 'msg91' | 'disabled';
  send(message: SmsMessage): Promise<SmsResult>;
}

export class PermanentSmsError extends Error {
  readonly permanent = true;
}
