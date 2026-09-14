export interface ServiceInputProps {
  id: string;
  name?: string;
  value: string[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  max?: number;
  maxLength?: number;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
}
