import {
  BODY_TYPE_LABELS,
  BodyType,
  FUEL_LABELS,
  FuelType,
  TRANSMISSION_LABELS,
  Transmission,
  VEHICLE_LIMITS,
  maxVehicleYear,
} from '@dealers-drive/contracts';

import { invalidProps } from '@/components/forms/field';
import { Input, Select } from '@/components/ui/input';

import { IdentityFields } from './identity-fields';
import { StepField } from './step-field';
import { VEHICLE_WIZARD_TEXT } from './vehicle-wizard.constants';
import type { StepProps } from './vehicle-wizard.types';
import { formValue } from './utils';

export function BasicsStep({
  vehicle,
  errors,
  values,
  suggestionsPath,
}: StepProps & { suggestionsPath?: string }) {
  const value = (field: string) => formValue(values, vehicle, field);
  const maxYear = maxVehicleYear();

  return (
    <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))] max-md:[grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr))]">
      <IdentityFields
        errors={errors}
        suggestionsPath={suggestionsPath}
        initial={{ make: value('make'), model: value('model'), variant: value('variant') }}
      />
      <StepField name="manufacturingYear" errors={errors}>
        <Input
          id="manufacturingYear"
          name="manufacturingYear"
          inputMode="numeric"
          defaultValue={value('manufacturingYear')}
          placeholder={String(maxYear - 3)}
          min={VEHICLE_LIMITS.minYear}
          max={maxYear}
          required
          className="tnum"
          {...invalidProps('manufacturingYear', errors.manufacturingYear)}
        />
      </StepField>
      <StepField
        name="registrationYear"
        errors={errors}
        hint={VEHICLE_WIZARD_TEXT.registrationYearHint}
      >
        <Input
          id="registrationYear"
          name="registrationYear"
          inputMode="numeric"
          defaultValue={value('registrationYear')}
          min={VEHICLE_LIMITS.minYear}
          max={maxYear}
          className="tnum"
          {...invalidProps('registrationYear', errors.registrationYear)}
        />
      </StepField>
      <StepField name="fuelType" errors={errors}>
        <Select
          id="fuelType"
          name="fuelType"
          defaultValue={value('fuelType')}
          required
          {...invalidProps('fuelType', errors.fuelType)}
        >
          <option value="">{VEHICLE_WIZARD_TEXT.choose}</option>
          {FuelType.options.map((option) => (
            <option key={option} value={option}>
              {FUEL_LABELS[option]}
            </option>
          ))}
        </Select>
      </StepField>
      <StepField name="transmission" errors={errors}>
        <Select
          id="transmission"
          name="transmission"
          defaultValue={value('transmission')}
          required
          {...invalidProps('transmission', errors.transmission)}
        >
          <option value="">{VEHICLE_WIZARD_TEXT.choose}</option>
          {Transmission.options.map((option) => (
            <option key={option} value={option}>
              {TRANSMISSION_LABELS[option]}
            </option>
          ))}
        </Select>
      </StepField>
      <StepField name="bodyType" errors={errors}>
        <Select
          id="bodyType"
          name="bodyType"
          defaultValue={value('bodyType')}
          required
          {...invalidProps('bodyType', errors.bodyType)}
        >
          <option value="">{VEHICLE_WIZARD_TEXT.choose}</option>
          {BodyType.options.map((option) => (
            <option key={option} value={option}>
              {BODY_TYPE_LABELS[option]}
            </option>
          ))}
        </Select>
      </StepField>
    </div>
  );
}
