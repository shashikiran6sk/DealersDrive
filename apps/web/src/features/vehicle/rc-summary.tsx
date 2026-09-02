'use client';

import { RC_CONFIDENCE_LABELS, type RcLookupResponse } from '@dealers-drive/contracts';

import { Banner, Plate, StatusTag } from '@/components/ui/primitives';

/**
 * "Here is what we found" — the panel above the pre-filled Basics form.
 *
 * ## Confidence is rendered, not hidden
 *
 * An `EXACT` match is stated; a `LIKELY` one is visibly marked for checking;
 * a `NONE` says so. This is the difference between a feature that saves a
 * dealer four minutes and one that publishes the wrong car under their name —
 * a resolver that is right nine times in ten and *says which nine* is useful,
 * one that presents everything as certain is not.
 *
 * The two permanent `NONE`s are not failures and are worded so:
 *
 *   `variantId`    — RC trim strings are truncated. `SWIFT VXI` might be a
 *                    VXi, a VXi (O) or a VXi AMT, which are a lakh apart.
 *   `transmission` — **a registration certificate does not record a gearbox.**
 *                    Not "we could not read it"; the field does not exist.
 */
export function RcSummary({ lookup }: { lookup: RcLookupResponse }) {
  const { basics } = lookup;
  const matched = basics.makeId.value !== null;

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex flex-wrap items-center gap-3">
        <Plate size="logo">{spaced(lookup.regNumber)}</Plate>
        {lookup.cached ? (
          // Honest, and quietly reassuring: they were not charged twice.
          <span className="text-[11px] ink-faint">from records we already had</span>
        ) : null}
      </div>

      {matched ? (
        <Banner tone="ok">
          <strong>
            {[basics.year.name, basics.makeId.name, basics.modelId.name].filter(Boolean).join(' ')}
          </strong>{' '}
          — check the details below and pick the variant. You can change anything that is wrong.
        </Banner>
      ) : (
        <Banner tone="warn">
          We found the registration but do not carry that make yet. Choose the closest match below,
          or enter the details by hand.
        </Banner>
      )}

      <dl className="grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        <Resolved label="Make" name={basics.makeId.name} confidence={basics.makeId.confidence} />
        <Resolved label="Model" name={basics.modelId.name} confidence={basics.modelId.confidence} />
        <Resolved label="Year" name={basics.year.name} confidence={basics.year.confidence} />
        <Resolved label="Fuel" name={basics.fuel.name} confidence={basics.fuel.confidence} />
      </dl>

      {lookup.advisories.length > 0 ? (
        <ul className="flex flex-col gap-[6px]">
          {lookup.advisories.map((advisory) => (
            <li
              key={advisory.code}
              className={`text-[13px] ${
                advisory.code === 'VEHICLE_BLACKLISTED'
                  ? 'text-(--color-err)'
                  : advisory.code === 'CHALLANS_OUTSTANDING' || advisory.code === 'NOC_ISSUED'
                    ? 'text-(--color-warn)'
                    : 'ink-secondary'
              }`}
            >
              {advisory.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Resolved({
  label,
  name,
  confidence,
}: {
  label: string;
  name: string | null;
  confidence: 'EXACT' | 'LIKELY' | 'NONE';
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.06em] ink-faint">{label}</dt>
      <dd className="mt-[2px] flex flex-wrap items-baseline gap-2 text-[14px]">
        {name ?? <span className="ink-faint">Not found</span>}
        {/*
          Only LIKELY is badged. EXACT needs no decoration, and badging NONE
          would put a warning chip beside a field the dealer simply has to
          fill — which reads as an error they caused.
        */}
        {confidence === 'LIKELY' ? (
          <StatusTag tone="warn">{RC_CONFIDENCE_LABELS.LIKELY}</StatusTag>
        ) : null}
      </dd>
    </div>
  );
}

/** `TN09BX1234` → `TN 09 BX 1234`, so the plate reads as a plate. */
function spaced(reg: string): string {
  const match = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{4})$/.exec(reg);
  if (!match) return reg;
  return [match[1], match[2], match[3], match[4]].filter(Boolean).join(' ');
}
