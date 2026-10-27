import type {
  DealerEnquiriesResponse,
  DealerEnquiry,
  EnquiryStatus,
} from '@dealers-drive/contracts';

import type { FinalStatus } from './enquiries.constants';

export interface EnquiryInboxProps {
  inbox: DealerEnquiriesResponse;
  status: EnquiryStatus;
  permissions?: readonly string[];
}

export interface EnquiryCardProps {
  enquiry: DealerEnquiry;
  permissions?: readonly string[];
}

export interface EnquiryStatusActionsProps {
  enquiryId: string;
  status: EnquiryStatus;
  customerName: string;
  permissions?: readonly string[];
}

export interface FinalMoveDialogProps {
  to: FinalStatus;
  label: string;
  customerName: string;
  disabled: boolean;
  loading: boolean;
  onConfirm: () => void;
}
