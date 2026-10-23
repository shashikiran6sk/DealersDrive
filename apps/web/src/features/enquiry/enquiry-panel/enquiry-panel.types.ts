import type { EnquiryCustomer, SendEnquiryState } from '@/features/enquiry/actions';

export interface EnquiryPanelProps {
  listingSlug: string;
  dealerName: string;
  autoOpen?: boolean;
  autoAction?: 'call' | 'callback';
  canCall?: boolean;
}

export type EnquiryPanelStage =
  'idle' | 'choices' | 'checking' | 'call' | 'form' | 'sent' | 'already' | 'gone';

export interface EnquiryFormProps {
  customer: EnquiryCustomer;
  dealerName: string;
  onSend: (message: string) => Promise<SendEnquiryState>;
  onCancel: () => void;
}
