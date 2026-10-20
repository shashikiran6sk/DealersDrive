import type { EnquiryCustomer, SendEnquiryState } from '@/features/enquiry/actions';

export interface EnquiryPanelProps {
  listingSlug: string;
  dealerName: string;
  autoOpen?: boolean;
}

export type EnquiryPanelStage = 'idle' | 'checking' | 'form' | 'sent' | 'already' | 'gone';

export interface EnquiryFormProps {
  customer: EnquiryCustomer;
  dealerName: string;
  onSend: (message: string) => Promise<SendEnquiryState>;
  onCancel: () => void;
}
