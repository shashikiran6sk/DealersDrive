import type { CustomerEnquiriesResponse, CustomerEnquiry } from '@dealers-drive/contracts';

export interface CustomerEnquiryListProps {
  enquiries: CustomerEnquiriesResponse;
}

export interface CustomerEnquiryCardProps {
  enquiry: CustomerEnquiry;
}
