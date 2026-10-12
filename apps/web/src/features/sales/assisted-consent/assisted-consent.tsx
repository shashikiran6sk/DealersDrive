'use client';

import { ASSISTED_CONSENT_TEXT } from '@dealers-drive/contracts';

import { CONSENT_TEXT } from './assisted-consent.constants';
import type { AssistedConsentProps } from './assisted-consent.types';

export function AssistedConsent({ id, checked, disabled = false, onChange }: AssistedConsentProps) {
  const textId = `${id}-text`;
  return (
    <label className="flex items-start gap-3 rounded-[12px] border border-(--color-divider) bg-white p-4 text-[13px]">
      <input
        id={id}
        type="checkbox"
        className="mt-[3px] h-4 w-4 flex-none"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={textId}
      />
      <span>
        <span className="block font-semibold">{CONSENT_TEXT.label}</span>
        <span id={textId} className="ink-body">
          {ASSISTED_CONSENT_TEXT}
        </span>
      </span>
    </label>
  );
}
