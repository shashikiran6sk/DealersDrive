import {
  INSURANCE_LABELS,
  InsuranceType,
  VEHICLE_LIMITS,
  ownerLabel,
} from '@dealers-drive/contracts';

import { invalidProps } from '@/components/forms/field';
import { Input, Select } from '@/components/ui/input';

import { StepField } from './step-field';
import { OWNER_OPTIONS, VEHICLE_WIZARD_TEXT } from './vehicle-wizard.constants';
import type { StepProps } from './vehicle-wizard.types';
import { formValue } from './utils';

export function DetailsStep({ vehicle, errors, values }: StepProps) {
  const value = (field: string) => formValue(values, vehicle, field);

  return (
    <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
      <StepField name="kilometersDriven" errors={errors}>
        <Input
          id="kilometersDriven"
          name="kilometersDriven"
          inputMode="numeric"
          defaultValue={value('kilometersDriven')}
          placeholder={VEHICLE_WIZARD_TEXT.kmPlaceholder}
          required
          className="tnum"
          {...invalidProps('kilometersDriven', errors.kilometersDriven)}
        />
      </StepField>
      <StepField name="ownerCount" errors={errors}>
        <Select
          id="ownerCount"
          name="ownerCount"
          defaultValue={value('ownerCount')}
          required
          {...invalidProps('ownerCount', errors.ownerCount)}
        >
          <option value="">{VEHICLE_WIZARD_TEXT.choose}</option>
          {OWNER_OPTIONS.map((count) => (
            <option key={count} value={count}>
              {ownerLabel(count)}
            </option>
          ))}
        </Select>
      </StepField>
      <StepField name="color" errors={errors}>
        <Input
          id="color"
          name="color"
          defaultValue={value('color')}
          placeholder={VEHICLE_WIZARD_TEXT.colorPlaceholder}
          maxLength={VEHICLE_LIMITS.colorMax}
          required
          {...invalidProps('color', errors.color)}
        />
      </StepField>
      <StepField name="insuranceType" errors={errors}>
        <Select
          id="insuranceType"
          name="insuranceType"
          defaultValue={value('insuranceType')}
          required
          {...invalidProps('insuranceType', errors.insuranceType)}
        >
          <option value="">{VEHICLE_WIZARD_TEXT.choose}</option>
          {InsuranceType.options.map((option) => (
            <option key={option} value={option}>
              {INSURANCE_LABELS[option]}
            </option>
          ))}
        </Select>
      </StepField>
      <StepField
        name="insuranceValidUntil"
        errors={errors}
        hint={VEHICLE_WIZARD_TEXT.insuranceDateHint}
      >
        <Input
          id="insuranceValidUntil"
          name="insuranceValidUntil"
          type="date"
          defaultValue={value('insuranceValidUntil')}
          className="tnum"
          {...invalidProps('insuranceValidUntil', errors.insuranceValidUntil)}
        />
      </StepField>
    </div>
  );
}
