import { env } from '../../config/env.js';

export type SmsTemplateName = 'sms.support.ticket-ack';

export interface SmsContext {
  reference: string;
}

export interface SmsTemplate {
  templateId(): string | undefined;
  variables(context: SmsContext): Record<string, string>;
  describe(context: SmsContext): string;
}

export const SMS_TEMPLATES: Record<SmsTemplateName, SmsTemplate> = {
  'sms.support.ticket-ack': {
    templateId: () => env.MSG91_TICKET_ACK_TEMPLATE_ID,
    variables: (context) => ({ reference: context.reference }),
    describe: (context) => `Support request ${context.reference} received`,
  },
};
