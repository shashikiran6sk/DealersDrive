export interface OtpInputProps {
  id: string;
  /** The digits typed so far, `''` to `length` characters. */
  value: string;
  onChange: (value: string) => void;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
  /** Fired once the last box is filled — the design's "verify as you finish". */
  onComplete?: (value: string) => void;
}
