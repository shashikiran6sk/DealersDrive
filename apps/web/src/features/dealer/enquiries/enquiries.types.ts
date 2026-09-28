import type {
  DealerEnquiriesResponse,
  DealerEnquiry,
  EnquiryStatus,
} from '@dealers-drive/contracts';

export interface EnquiryInboxProps {
  inbox: DealerEnquiriesResponse;
  status: EnquiryStatus;
}

export interface EnquiryCardProps {
  enquiry: DealerEnquiry;
}

export interface EnquiryStatusActionsProps {
  enquiryId: string;
  status: EnquiryStatus;
  customerName: string;
}
