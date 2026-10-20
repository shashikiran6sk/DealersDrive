export interface EnquiryCustomer {
  fullName: string;
  phoneDisplay: string;
}

export type SendEnquiryState =
  | {
      status: 'sent';
      receipt: {
        id: string;
        status: 'NEW';
        createdAt: string;
        dealerName: string;
        vehicleTitle: string;
      };
    }
  | { status: 'signed-out' }
  | { status: 'refused'; code: string; message: string }
  | { status: 'invalid'; message: string };

export const enquiryActionStub: {
  delayMs: number;
  customer: EnquiryCustomer | null;
  result: SendEnquiryState;
} = {
  delayMs: 600,
  customer: { fullName: 'Shashikiran', phoneDisplay: '+91 98400 12345' },
  result: {
    status: 'sent',
    receipt: {
      id: 'enquiry-1',
      status: 'NEW',
      createdAt: '2026-09-28T10:30:00.000Z',
      dealerName: 'Sri Lakshmi Motors',
      vehicleTitle: '2023 Hyundai Creta SX(O)',
    },
  },
};

function settle<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), enquiryActionStub.delayMs));
}

export function enquiryCustomerAction(): Promise<EnquiryCustomer | null> {
  return settle(enquiryActionStub.customer);
}

export function sendEnquiryAction(): Promise<SendEnquiryState> {
  return settle(enquiryActionStub.result);
}
