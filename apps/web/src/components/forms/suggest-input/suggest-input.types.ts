import type { VehicleSuggestField } from '@dealers-drive/contracts';

export interface SuggestInputProps {
  id: string;
  field: VehicleSuggestField;
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  disabled?: boolean;
  'aria-invalid'?: 'true';
  'aria-describedby'?: string;
}
