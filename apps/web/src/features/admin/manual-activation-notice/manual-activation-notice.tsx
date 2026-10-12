import type { DealerActivationState } from '@dealers-drive/contracts';

import { Banner } from '@/components/ui/primitives';
import { formatIstDateTime } from '@/lib/dates';
import { documentGapLabel } from '@/lib/document-gaps';

import { MANUAL_ACTIVATION_NOTICE_TEXT } from './manual-activation-notice.constants';

function activatedLine(activation: DealerActivationState): string {
  if (!activation.overriddenAt) return MANUAL_ACTIVATION_NOTICE_TEXT.unknownWhen;
  const when = formatIstDateTime(activation.overriddenAt);
  return activation.overriddenBy
    ? MANUAL_ACTIVATION_NOTICE_TEXT.activatedBy(activation.overriddenBy, when)
    : MANUAL_ACTIVATION_NOTICE_TEXT.activatedWhen(when);
}

export function ManualActivationNotice({ activation }: { activation: DealerActivationState }) {
  if (activation.method !== 'MANUAL_OVERRIDE') return null;

  return (
    <Banner
      tone="warn"
      title={activation.methodLabel ?? MANUAL_ACTIVATION_NOTICE_TEXT.fallbackTitle}
    >
      <div className="flex flex-col gap-2">
        <p>{activatedLine(activation)}</p>
        {activation.justification ? (
          <p>
            <strong>{MANUAL_ACTIVATION_NOTICE_TEXT.justificationLabel}:</strong>{' '}
            {activation.justification}
          </p>
        ) : null}
        {activation.outstanding.length > 0 ? (
          <div>
            <strong>{MANUAL_ACTIVATION_NOTICE_TEXT.outstandingLabel}:</strong>
            <ul className="mt-1 list-disc pl-5">
              {activation.outstanding.map((gap) => (
                <li key={gap}>{documentGapLabel(gap)}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p>{MANUAL_ACTIVATION_NOTICE_TEXT.outstandingNone}</p>
        )}
        <p className="text-[12px]">{MANUAL_ACTIVATION_NOTICE_TEXT.neverVerifies}</p>
      </div>
    </Banner>
  );
}
