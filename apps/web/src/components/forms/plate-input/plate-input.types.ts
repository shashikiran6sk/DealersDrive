export interface PlateInputProps {
  id: string;
  name?: string;
  label?: string;
  defaultValue?: string;
  error?: string | undefined;
  hint?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  required?: boolean;
}
