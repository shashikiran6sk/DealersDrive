import { NEGOTIABILITY_LABELS, PriceNegotiability, VEHICLE_LIMITS } from '@dealers-drive/contracts';

import { invalidProps } from '@/components/forms/field';
import { Input, Select, Textarea } from '@/components/ui/input';

import { StepField } from './step-field';
import { VEHICLE_WIZARD_TEXT } from './vehicle-wizard.constants';
import type { StepProps } from './vehicle-wizard.types';
import { formValue } from './utils';

export function PricingStep({ vehicle, errors, values }: StepProps) {
  const value = (field: string) => formValue(values, vehicle, field);

  return (
    <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))] max-md:[grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr))]">
      <StepField name="priceRupees" errors={errors} hint={VEHICLE_WIZARD_TEXT.priceHint}>
        <Input
          id="priceRupees"
          name="priceRupees"
          inputMode="numeric"
          defaultValue={value('priceRupees')}
          placeholder={VEHICLE_WIZARD_TEXT.pricePlaceholder}
          required
          className="tnum"
          {...invalidProps('priceRupees', errors.priceRupees)}
        />
      </StepField>
      <StepField name="negotiability" errors={errors}>
        <Select
          id="negotiability"
          name="negotiability"
          defaultValue={value('negotiability') || 'FIXED'}
          {...invalidProps('negotiability', errors.negotiability)}
        >
          {PriceNegotiability.options.map((option) => (
            <option key={option} value={option}>
              {NEGOTIABILITY_LABELS[option]}
            </option>
          ))}
        </Select>
      </StepField>
      <StepField name="description" errors={errors} hint={VEHICLE_WIZARD_TEXT.descriptionHint} wide>
        <Textarea
          id="description"
          name="description"
          defaultValue={value('description')}
          placeholder={VEHICLE_WIZARD_TEXT.descriptionPlaceholder}
          maxLength={VEHICLE_LIMITS.descriptionMax}
          rows={5}
          {...invalidProps('description', errors.description)}
        />
      </StepField>
    </div>
  );
}
