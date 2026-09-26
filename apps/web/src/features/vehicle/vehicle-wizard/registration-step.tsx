import { PlateInput } from '@/components/forms/plate-input';

import type { StepProps } from './vehicle-wizard.types';
import { formValue } from './utils';

export function RegistrationStep({ vehicle, errors, values }: StepProps) {
  return (
    <div className="max-w-[340px]">
      <PlateInput
        id="registrationNumber"
        defaultValue={formValue(values, vehicle, 'registrationNumber')}
        error={errors.registrationNumber}
        autoFocus={vehicle === null}
        required
      />
    </div>
  );
}
