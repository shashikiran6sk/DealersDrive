export interface ServiceInputProps {
  /** Labels the visible draft box, so the `<Field>`'s label points at it. */
  id: string;
  /** The form key. `undefined` submits nothing — the R34 waiting-for-review lock. */
  name?: string;
  value: string[];
  placeholder?: string;
  disabled?: boolean;
  /** Blocks submit with the browser's own message while the list is empty. */
  required?: boolean;
  max?: number;
  maxLength?: number;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
}
