'use client';
import { ENQUIRY_NOTICE, LEGAL_VERSION, LISTING_CERTIFICATION } from '@dealers-drive/contracts';
import { useId, useState, type ReactNode } from 'react';
import { useLegalEnabled } from '../legal-provider';
export interface LegalCheckProps {
  kind: 'account' | 'dealer' | 'certification' | 'enquiry';
  dealerName?: string;
  onCompleteChange?: (complete: boolean) => void;
}
function DocumentLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold underline underline-offset-2"
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
export function LegalCheck({ kind, dealerName, onCompleteChange }: LegalCheckProps) {
  const id = useId();
  const enabled = useLegalEnabled();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  if (!enabled) return null;
  const fields: { name: string; label: ReactNode }[] =
    kind === 'certification'
      ? [
          {
            name: 'certified',
            label: (
              <>
                {LISTING_CERTIFICATION}{' '}
                <DocumentLink href="/listing-policy">Read the policy</DocumentLink>.
              </>
            ),
          },
        ]
      : kind === 'enquiry'
        ? [
            {
              name: 'sharingGranted',
              label: (
                <>
                  I permit sharing these details with {dealerName ?? 'this dealership'} for this
                  enquiry. <DocumentLink href="/privacy">Privacy Policy</DocumentLink>.
                </>
              ),
            },
          ]
        : [
            {
              name: 'termsAccepted',
              label: (
                <>
                  I am at least 18 and accept the{' '}
                  <DocumentLink href="/terms">Terms of Use</DocumentLink>.
                </>
              ),
            },
            {
              name: 'privacyAcknowledged',
              label: (
                <>
                  I have read the <DocumentLink href="/privacy">Privacy Policy</DocumentLink>. This
                  acknowledges the notice; it is not permission for unrelated marketing.
                </>
              ),
            },
            ...(kind === 'dealer'
              ? [
                  {
                    name: 'authorityConfirmed',
                    label: (
                      <>
                        I accept the{' '}
                        <DocumentLink href="/dealer-terms">Dealer Agreement</DocumentLink> and
                        confirm that I am an owner authorized to bind this dealership.
                      </>
                    ),
                  },
                ]
              : []),
          ];
  return (
    <fieldset className="min-w-0 rounded-[12px] border border-(--color-divider) p-4">
      <legend className="px-1 text-[13px] font-semibold">
        {kind === 'enquiry'
          ? 'Your choice before sending'
          : kind === 'certification'
            ? 'Listing declaration'
            : 'Your agreements'}
      </legend>
      <input type="hidden" name="legalVersion" value={LEGAL_VERSION} />
      {kind === 'enquiry' ? (
        <p className="mb-2 text-[13px] leading-[1.7]">{ENQUIRY_NOTICE}</p>
      ) : null}
      {fields.map(({ name, label }) => (
        <label
          key={name}
          htmlFor={`${id}-${name}`}
          className="flex min-h-[44px] cursor-pointer items-start gap-3 py-2 text-[13px] leading-[1.7]"
        >
          <input
            id={`${id}-${name}`}
            name={name}
            type="checkbox"
            value="true"
            required
            checked={checked[name] ?? false}
            className="mt-1 h-[18px] w-[18px] shrink-0 accent-black"
            onChange={(event) => {
              const next = { ...checked, [name]: event.target.checked };
              setChecked(next);
              onCompleteChange?.(fields.every((field) => next[field.name]));
            }}
          />
          <span>{label}</span>
        </label>
      ))}
      <p className="mt-1 text-[11px] ink-subtle">
        Document version {LEGAL_VERSION}. Your choices are recorded when you continue.
      </p>
    </fieldset>
  );
}
