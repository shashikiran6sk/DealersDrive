'use client';

import { ENQUIRY_NOTICE_VERSION, LEGAL_VERSION } from '@dealers-drive/contracts';
import { useId, useState } from 'react';

import { useLegalEnabled } from '../legal-provider';
import { LEGAL_CHECK_TEXT } from './legal-check.constants';

export interface LegalCheckProps {
  kind: 'account' | 'dealer' | 'certification' | 'enquiry';
  dealerName?: string;
  onCompleteChange?: (complete: boolean) => void;
}

export function LegalCheck({ kind, dealerName, onCompleteChange }: LegalCheckProps) {
  const id = useId();
  const enabled = useLegalEnabled();
  const [checked, setChecked] = useState(false);
  if (!enabled) return null;
  const name =
    kind === 'enquiry'
      ? 'sharingGranted'
      : kind === 'certification'
        ? 'certified'
        : 'termsAccepted';
  return (
    <div className="flex min-w-0 items-start gap-3 text-[13px] leading-[1.7]">
      <input
        type="hidden"
        name="legalVersion"
        value={kind === 'enquiry' ? ENQUIRY_NOTICE_VERSION : LEGAL_VERSION}
      />
      <input
        id={id}
        aria-labelledby={`${id}-label`}
        name={name}
        type="checkbox"
        value="true"
        required
        checked={checked}
        className="mt-1 h-[18px] w-[18px] shrink-0 accent-black"
        onChange={(event) => {
          setChecked(event.target.checked);
          onCompleteChange?.(event.target.checked);
        }}
      />
      <span id={`${id}-label`} className="min-w-0 [overflow-wrap:anywhere]">
        <label htmlFor={id} className="cursor-pointer">
          {kind === 'enquiry'
            ? LEGAL_CHECK_TEXT.sharing(dealerName ?? LEGAL_CHECK_TEXT.dealership)
            : kind === 'certification'
              ? LEGAL_CHECK_TEXT.certification
              : kind === 'dealer'
                ? LEGAL_CHECK_TEXT.dealer
                : LEGAL_CHECK_TEXT.account}
        </label>{' '}
        {kind !== 'enquiry' ? (
          <>
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2"
            >
              {LEGAL_CHECK_TEXT.terms}
            </a>{' '}
            {kind !== 'certification' ? (
              <>
                <label htmlFor={id} className="cursor-pointer">
                  {LEGAL_CHECK_TEXT.acknowledge}
                </label>{' '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline underline-offset-2"
                >
                  {LEGAL_CHECK_TEXT.privacy}
                </a>
              </>
            ) : null}
            {LEGAL_CHECK_TEXT.period}
          </>
        ) : (
          <a
            href="/privacy#contact-sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {LEGAL_CHECK_TEXT.sharingDetails}
          </a>
        )}
      </span>
    </div>
  );
}
