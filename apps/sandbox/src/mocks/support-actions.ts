import type {
  CreateSupportRequestResult,
  ReplySupportRequestResult,
  SupportRequestDraft,
} from '../../../web/src/features/support/support-actions';

export type { CreateSupportRequestResult, ReplySupportRequestResult, SupportRequestDraft };

export const supportActionStub: {
  create: CreateSupportRequestResult | null;
  reply: ReplySupportRequestResult;
  delayMs: number;
} = {
  create: null,
  reply: { status: 'sent' },
  delayMs: 600,
};

export async function createSupportRequestAction(
  _draft: SupportRequestDraft,
): Promise<CreateSupportRequestResult> {
  await new Promise((resolve) => setTimeout(resolve, supportActionStub.delayMs));
  return (
    supportActionStub.create ?? {
      status: 'created',
      id: '11111111-1111-4111-8111-111111111111',
    }
  );
}

export async function replySupportRequestAction(
  _ticketId: string,
  _message: string,
): Promise<ReplySupportRequestResult> {
  await new Promise((resolve) => setTimeout(resolve, supportActionStub.delayMs));
  return supportActionStub.reply;
}
