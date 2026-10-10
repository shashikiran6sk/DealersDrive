import type { Prisma, SupportMessageAuthor } from '@prisma/client';
import { ConflictError } from '../../platform/errors.js';
export async function isPersistedRetry(
  tx: Prisma.TransactionClient,
  ticketId: string,
  author: SupportMessageAuthor,
  message: string,
  clientMessageId?: string,
  authorId?: string,
) {
  if (!clientMessageId) return false;
  const previous = await tx.supportTicketMessage.findUnique({
    where: {
      ticketId_authorType_clientMessageId: { ticketId, authorType: author, clientMessageId },
    },
  });
  if (!previous) return false;
  if (previous.body !== message || (authorId && previous.authorId !== authorId))
    throw new ConflictError(
      'SUPPORT_MESSAGE_RETRY_CONFLICT',
      'This reply identifier was already used for different text. Refresh the conversation before sending another reply.',
    );
  return true;
}
