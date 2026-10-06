import type { DealerVehicle } from '@dealers-drive/contracts';
import {
  BODY_TYPE_LABELS,
  FUEL_LABELS,
  INSURANCE_LABELS,
  NEGOTIABILITY_LABELS,
  TRANSMISSION_LABELS,
  VEHICLE_COLOR_LABELS,
  formatDate,
  formatKm,
  ownerLabel,
} from '@dealers-drive/contracts';
import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { Banner, Blueprint } from '@/components/ui/primitives';

import { FIELD_LABELS, STEP_LABELS, VEHICLE_WIZARD_TEXT } from './vehicle-wizard.constants';
import type { WizardStep } from './vehicle-wizard.types';
import { editPath, stepOfField } from './utils';

interface Row {
  label: string | undefined;
  value: string | null;
}

function sections(vehicle: DealerVehicle): { step: WizardStep; rows: Row[] }[] {
  return [
    {
      step: 'registration',
      rows: [{ label: FIELD_LABELS.registrationNumber, value: vehicle.registrationDisplay }],
    },
    {
      step: 'basics',
      rows: [
        { label: FIELD_LABELS.make, value: vehicle.make },
        { label: FIELD_LABELS.model, value: vehicle.model },
        { label: FIELD_LABELS.variant, value: vehicle.variant },
        {
          label: FIELD_LABELS.manufacturingYear,
          value: vehicle.manufacturingYear?.toString() ?? null,
        },
        {
          label: FIELD_LABELS.registrationYear,
          value: vehicle.registrationYear?.toString() ?? null,
        },
        {
          label: FIELD_LABELS.fuelType,
          value: vehicle.fuelType ? FUEL_LABELS[vehicle.fuelType] : null,
        },
        {
          label: FIELD_LABELS.transmission,
          value: vehicle.transmission ? TRANSMISSION_LABELS[vehicle.transmission] : null,
        },
        {
          label: FIELD_LABELS.bodyType,
          value: vehicle.bodyType ? BODY_TYPE_LABELS[vehicle.bodyType] : null,
        },
      ],
    },
    {
      step: 'details',
      rows: [
        {
          label: FIELD_LABELS.kilometersDriven,
          value: vehicle.kilometersDriven === null ? null : formatKm(vehicle.kilometersDriven),
        },
        {
          label: FIELD_LABELS.ownerCount,
          value: vehicle.ownerCount ? ownerLabel(vehicle.ownerCount) : null,
        },
        {
          label: FIELD_LABELS.color,
          value: vehicle.color ? VEHICLE_COLOR_LABELS[vehicle.color] : null,
        },
        {
          label: FIELD_LABELS.insuranceType,
          value: vehicle.insuranceType ? INSURANCE_LABELS[vehicle.insuranceType] : null,
        },
        {
          label: FIELD_LABELS.insuranceValidUntil,
          value: vehicle.insuranceValidUntil ? formatDate(vehicle.insuranceValidUntil) : null,
        },
      ],
    },
    {
      step: 'pricing',
      rows: [
        { label: FIELD_LABELS.priceRupees, value: vehicle.priceLabel },
        {
          label: FIELD_LABELS.negotiability,
          value: vehicle.negotiability ? NEGOTIABILITY_LABELS[vehicle.negotiability] : null,
        },
        { label: FIELD_LABELS.description, value: vehicle.description },
      ],
    },
  ];
}

export function ReviewStep({
  vehicle,
  readOnly = false,
}: {
  vehicle: DealerVehicle;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[16px]">
      {readOnly ? null : vehicle.complete ? (
        <Banner tone="ok">{VEHICLE_WIZARD_TEXT.reviewComplete}</Banner>
      ) : (
        <Banner tone="warn" title={VEHICLE_WIZARD_TEXT.reviewIncomplete}>
          <ul className="mt-1 flex flex-col gap-[4px]">
            {vehicle.issues.map((issue) => (
              <li key={issue.field} className="flex flex-wrap items-baseline gap-2">
                <span>{issue.message}</span>
                <Link
                  className="relative btn btn-ghost text-[12px]"
                  href={editPath(vehicle.id, stepOfField(issue.field))}
                >
                  <LinkPendingLabel>{VEHICLE_WIZARD_TEXT.fix}</LinkPendingLabel>
                </Link>
              </li>
            ))}
          </ul>
        </Banner>
      )}

      <Blueprint className="bg-(--color-accent-100) p-[16px]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[19px]">{vehicle.title}</h3>
          {vehicle.priceLabel ? (
            <span className="text-[20px] font-semibold tnum">{vehicle.priceLabel}</span>
          ) : null}
        </div>
        {vehicle.summary ? <p className="text-[13px] ink-muted tnum">{vehicle.summary}</p> : null}
      </Blueprint>

      {sections(vehicle).map((section) => (
        <section key={section.step} className="flex flex-col">
          <div className="flex items-center justify-between border-b border-(--color-divider) pb-[6px]">
            <h4 className="text-[14px] font-semibold">{STEP_LABELS[section.step]}</h4>
            {readOnly ? null : (
              <Link
                className="relative btn btn-ghost text-[12px]"
                href={editPath(vehicle.id, section.step)}
              >
                <LinkPendingLabel>{VEHICLE_WIZARD_TEXT.edit}</LinkPendingLabel>
              </Link>
            )}
          </div>
          <dl className="grid [grid-template-columns:minmax(140px,220px)_1fr]">
            {section.rows.map((row) => (
              <div key={row.label ?? ''} className="contents">
                <dt className="border-b border-[rgba(20,23,28,0.08)] py-[8px] text-[13px] ink-muted">
                  {row.label}
                </dt>
                <dd
                  className={`border-b border-[rgba(20,23,28,0.08)] py-[8px] text-[13px] tnum ${row.value ? 'font-medium' : 'ink-faint'}`}
                >
                  {row.value ?? VEHICLE_WIZARD_TEXT.notEntered}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <p className="text-[12px] ink-subtle">{VEHICLE_WIZARD_TEXT.reviewNoPhotos}</p>
    </div>
  );
}
