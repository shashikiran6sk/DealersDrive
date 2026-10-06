import type { SalesActionResult } from '@/features/sales/sales-actions';

export interface AssistedDealerFormProps {
  initial: Record<string, string>;
  initialServices: string[];
  submitLabel: string;
  partial: boolean;
  disabled?: boolean;
  onSubmit: (values: Record<string, unknown>) => Promise<SalesActionResult>;
  onDone?: (result: SalesActionResult) => void;
}
