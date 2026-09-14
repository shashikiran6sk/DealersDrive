import { z } from 'zod';

export const UploadQuery = z
  .object({
    key: z.string().min(1).max(300),
    contentType: z.string().min(1).max(120),
    contentLength: z.coerce.number().int().min(1),
    expiresAt: z.coerce.number().int(),
    signature: z.string().min(16).max(256),
  })
  .strict();

export const MediaPath = z
  .object({ mediaId: z.string().uuid(), width: z.coerce.number().int().min(1).max(4000) })
  .strict();
