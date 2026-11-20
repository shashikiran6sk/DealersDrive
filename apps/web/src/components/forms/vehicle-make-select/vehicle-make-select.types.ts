export interface VehicleMakeSelectProps {
  id: string;
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onValueChange?: (make: string) => void;
  'aria-invalid'?: 'true';
  'aria-describedby'?: string;
}
