import type { EnquirySharingPermission } from '@dealers-drive/contracts';
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
  onSend: (message: string, sharing?: EnquirySharingPermission) => Promise<SendEnquiryState>;
  onCancel: () => void;
}
