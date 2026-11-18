'use client';

import { VEHICLE_LIMITS, canonicalVehicleMake } from '@dealers-drive/contracts';
import { useState } from 'react';

import { invalidProps } from '@/components/forms/field';
import { VehicleMakeSelect } from '@/components/forms/vehicle-make-select';
import { VehicleOptionSelect } from '@/components/forms/vehicle-option-select';

import { StepField } from './step-field';
import { VEHICLE_WIZARD_TEXT } from './vehicle-wizard.constants';

export interface IdentityFieldsProps {
  errors: Record<string, string>;
  initial: { make: string; model: string; variant: string };
}

export function IdentityFields({ errors, initial }: IdentityFieldsProps) {
  const initialMake = canonicalVehicleMake(initial.make) ?? initial.make.trim();
  const [make, setMake] = useState(initialMake);
  const [model, setModel] = useState(initial.model.trim());
  const keepModel = make === initialMake;
  const keepVariant = keepModel && model === initial.model.trim();

  function chooseMake(next: string) {
    setMake(next);
    setModel(next === initialMake ? initial.model.trim() : '');
  }

  return (
    <>
      <StepField name="make" errors={errors} hint={VEHICLE_WIZARD_TEXT.makeHint}>
        <VehicleMakeSelect
          id="make"
          defaultValue={initial.make}
          placeholder={VEHICLE_WIZARD_TEXT.makePlaceholder}
          required
          onValueChange={chooseMake}
          {...invalidProps('make', errors.make)}
        />
      </StepField>
      <StepField name="model" errors={errors}>
        <VehicleOptionSelect
          key={`model:${make}`}
          id="model"
          field="model"
          make={make}
          defaultValue={keepModel ? initial.model : ''}
          placeholder={VEHICLE_WIZARD_TEXT.modelPlaceholder}
          maxLength={VEHICLE_LIMITS.textMax}
          required
          onValueChange={setModel}
          {...invalidProps('model', errors.model)}
        />
      </StepField>
      <StepField name="variant" errors={errors} hint={VEHICLE_WIZARD_TEXT.variantHint}>
        <VehicleOptionSelect
          key={`variant:${make}:${model}`}
          id="variant"
          field="variant"
          make={make}
          model={model}
          defaultValue={keepVariant ? initial.variant : ''}
          placeholder={VEHICLE_WIZARD_TEXT.variantPlaceholder}
          maxLength={VEHICLE_LIMITS.textMax}
          {...invalidProps('variant', errors.variant)}
        />
      </StepField>
    </>
  );
}
