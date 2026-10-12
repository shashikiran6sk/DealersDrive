'use client';

import {
  ACTIVATION_JUSTIFICATION_MAX,
  ACTIVATION_JUSTIFICATION_MIN,
  ActivationOverrideInput,
  MANUAL_ACTIVATION_DISCLAIMER,
  MANUAL_ACTIVATION_DISCLAIMER_VERSION,
  type AdminDealerDetail,
} from '@dealers-drive/contracts';
import { useState } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { overrideActivationAction } from '@/features/admin/actions';
import { documentGapLabel } from '@/lib/document-gaps';

import { DEALER_ACTIONS_TEXT } from './dealer-actions.constants';
import type { ActionBlockProps } from './dealer-actions.types';

export interface ActivationOverrideBlockProps extends ActionBlockProps {
  dealer: AdminDealerDetail;
}

export function ActivationOverrideBlock({ dealer, pending, run }: ActivationOverrideBlockProps) {
  const [justification, setJustification] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  const blockedReason = dealer.actions.canOverrideActivation
    ? null
    : dealer.actions.overrideBlockedReason;

  if (blockedReason) {
    return (
      <div className="flex flex-col gap-2 border-t border-(--color-divider) pt-3">
        <h3 className="text-[15px] font-medium">{DEALER_ACTIONS_TEXT.overrideHeading}</h3>
        <p className="text-[13px] ink-secondary">
          {DEALER_ACTIONS_TEXT.overrideBlockedPrefix}
          {blockedReason}
        </p>
      </div>
    );
  }

  const body = {
    justification,
    ...(acknowledged ? { acknowledgedDisclaimer: MANUAL_ACTIVATION_DISCLAIMER_VERSION } : {}),
  };
  const valid = ActivationOverrideInput.safeParse(body).success;
  const canSubmit = dealer.actions.canOverrideActivation && valid && !pending;
  const outstanding = dealer.activation.outstanding;

  return (
    <div className="flex flex-col gap-3 border-t border-(--color-divider) pt-3">
      <h3 className="text-[15px] font-medium">{DEALER_ACTIONS_TEXT.overrideHeading}</h3>
      <p className="text-[12px] ink-secondary">{DEALER_ACTIONS_TEXT.overrideIntro}</p>

      {outstanding.length > 0 ? (
        <div className="text-[12px] ink-secondary">
          <strong>{DEALER_ACTIONS_TEXT.overrideOutstanding}:</strong>{' '}
          {outstanding.map(documentGapLabel).join(', ')}
        </div>
      ) : null}

      <div className="border border-(--color-divider) bg-(--color-warn-bg) p-3 text-[13px]">
        <p className="eyebrow">{DEALER_ACTIONS_TEXT.overrideDisclaimerHeading}</p>
        <p className="mt-1 ink-body">{MANUAL_ACTIVATION_DISCLAIMER}</p>
        <label className="mt-2 flex items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            disabled={pending}
            className="mt-[3px]"
          />
          <span>{DEALER_ACTIONS_TEXT.overrideAcknowledge}</span>
        </label>
      </div>

      <Field
        id="overrideJustification"
        label={DEALER_ACTIONS_TEXT.overrideJustificationLabel}
        hint={DEALER_ACTIONS_TEXT.overrideJustificationHint(ACTIVATION_JUSTIFICATION_MIN)}
      >
        <Textarea
          id="overrideJustification"
          value={justification}
          rows={3}
          maxLength={ACTIVATION_JUSTIFICATION_MAX}
          placeholder={DEALER_ACTIONS_TEXT.overrideJustificationPlaceholder}
          onChange={(event) => setJustification(event.target.value)}
          disabled={pending}
        />
        <p className="mt-1 text-[11px] ink-faint tnum">
          {DEALER_ACTIONS_TEXT.overrideJustificationCount(
            justification.trim().length,
            ACTIVATION_JUSTIFICATION_MIN,
          )}
        </p>
      </Field>

      <Button
        variant="secondary"
        size="md"
        className="self-start"
        loading={pending}
        disabled={!canSubmit}
        onClick={() => {
          if (!canSubmit) return;
          run(async () => {
            const result = await overrideActivationAction(
              dealer.id,
              {
                justification: justification.trim(),
                acknowledgedDisclaimer: MANUAL_ACTIVATION_DISCLAIMER_VERSION,
              },
              dealer.slug,
            );
            if (result.ok) {
              setJustification('');
              setAcknowledged(false);
            }
            return result;
          }, DEALER_ACTIONS_TEXT.overridden);
        }}
      >
        {DEALER_ACTIONS_TEXT.override}
      </Button>
    </div>
  );
}
