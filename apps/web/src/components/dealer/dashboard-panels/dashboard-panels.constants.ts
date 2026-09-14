export const RECENT_ENQUIRIES_SHOWN = 4;

export const RECENT_ENQUIRIES_TEXT = {
  heading: 'Recent enquiries',
  empty: 'No enquiries yet. They land here the moment a buyer taps Enquire or Call.',
  generalEnquiry: 'General enquiry',
  callLabel: 'Call',
  callAriaLabel: (name: string, phoneDisplay: string) => `Call ${name} on ${phoneDisplay}`,
} as const;
