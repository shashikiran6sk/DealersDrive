import { z } from 'zod';

/**
 * The controlled exception to standard approval (#299): a Super admin may
 * activate a dealership that has not completed the identity and business
 * document review, when policy permits it. It is recorded as such, shown as
 * such, and changes nothing about the documents or Dealer Verified.
 */
export const DealerActivationMethod = z.enum(['STANDARD', 'MANUAL_OVERRIDE']);
export type DealerActivationMethod = z.infer<typeof DealerActivationMethod>;

export const DEALER_ACTIVATION_METHOD_LABELS: Record<DealerActivationMethod, string> = {
  STANDARD: 'Standard approval',
  MANUAL_OVERRIDE: 'Manual activation — documents not verified',
};

export const MANUAL_ACTIVATION_DISCLAIMER_VERSION = 'manual-activation-2026-10-12';
export const MANUAL_ACTIVATION_DISCLAIMER =
  'This dealership has not completed the standard personal and business document verification process. Manual activation does not establish that its identity, business registration or regulatory authorization has been verified. Proceed only when the exception is permitted by the applicable policy and legal requirements. Your approval and justification will be recorded.';

export const ACTIVATION_JUSTIFICATION_MIN = 40;
export const ACTIVATION_JUSTIFICATION_MAX = 2000;

export const ActivationOverrideInput = z
  .object({
    justification: z
      .string()
      .trim()
      .min(
        ACTIVATION_JUSTIFICATION_MIN,
        'Explain why policy permits activating this dealership without verified documents.',
      )
      .max(ACTIVATION_JUSTIFICATION_MAX),
    acknowledgedDisclaimer: z.literal(MANUAL_ACTIVATION_DISCLAIMER_VERSION, {
      error: 'Read and acknowledge the manual activation disclaimer.',
    }),
    gstNotRequiredReview: z.string().trim().min(20).max(1000).optional(),
  })
  .strict();
export type ActivationOverrideInput = z.infer<typeof ActivationOverrideInput>;

export const RevokeActivationOverrideInput = z
  .object({
    reason: z
      .string()
      .trim()
      .min(20, 'Explain why the manual activation is being withdrawn.')
      .max(1000),
  })
  .strict();
export type RevokeActivationOverrideInput = z.infer<typeof RevokeActivationOverrideInput>;

export const DealerActivationState = z.object({
  method: DealerActivationMethod.nullable(),
  methodLabel: z.string().nullable(),
  overriddenAt: z.string().nullable(),
  overriddenBy: z.string().nullable(),
  justification: z.string().nullable(),
  /** Document categories still unverified; never hidden by an override. */
  outstanding: z.array(z.string()),
});
export type DealerActivationState = z.infer<typeof DealerActivationState>;

export const ActivationOverrideResponse = z.object({
  dealerId: z.string().uuid(),
  status: z.string(),
  activation: DealerActivationState,
});
export type ActivationOverrideResponse = z.infer<typeof ActivationOverrideResponse>;
