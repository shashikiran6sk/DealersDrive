export interface OtpInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
  onComplete?: (value: string) => void;
}
