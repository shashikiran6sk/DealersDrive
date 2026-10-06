import type {
  DealerEnquiriesResponse,
  DealerEnquiry,
  EnquiryStatus,
} from '@dealers-drive/contracts';

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
