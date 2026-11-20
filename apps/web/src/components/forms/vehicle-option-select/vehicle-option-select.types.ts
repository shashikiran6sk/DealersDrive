export type VehicleOptionField = 'model' | 'variant';

export type VehicleOptionStatus = 'idle' | 'loading' | 'ready' | 'failed';

export interface VehicleOptionScope {
  field: VehicleOptionField;
  make: string;
  model?: string;
}

export type VehicleOptionRow = { kind: 'option'; value: string } | { kind: 'new'; value: string };

export interface VehicleOptionSelectProps {
  id: string;
  field: VehicleOptionField;
  make: string;
  model?: string;
  source?: string;
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  'aria-invalid'?: 'true';
  'aria-describedby'?: string;
}
