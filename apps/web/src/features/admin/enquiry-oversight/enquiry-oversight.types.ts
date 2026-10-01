import type {
  AdminEnquiriesResponse,
  AdminEnquiryRow,
  EnquiryStatus,
} from '@dealers-drive/contracts';

export interface EnquiryOversightFilters {
  status?: EnquiryStatus;
  q?: string;
  dealer?: string;
  from?: string;
  to?: string;
}

export interface EnquiryOversightProps {
  enquiries: AdminEnquiriesResponse;
  filters: EnquiryOversightFilters;
}

export interface EnquiryOversightRowProps {
  row: AdminEnquiryRow;
  filters: EnquiryOversightFilters;
}
