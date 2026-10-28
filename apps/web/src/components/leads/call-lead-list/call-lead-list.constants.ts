export const CALL_LEAD_TEXT = {
  title: 'Customer calls',
  listLabel: 'Call leads',
  dealerIntro:
    'Customers who revealed your number to call you about a car. Each one agreed to share their name and mobile — ring back anyone you missed.',
  adminIntro:
    'Customers who revealed a dealership’s customer contact number, one row per customer and car.',
  about: 'Viewed the number for',
  firstViewed: (date: string) => `First viewed ${date}`,
  viewedTimes: (count: number, date: string) => `Viewed ${count} times since ${date}`,
  call: (phoneDisplay: string) => `Call ${phoneDisplay}`,
  noNumber: 'Number no longer on file',
  dealer: 'Dealership',
  more: 'Show more',
  emptyTitle: 'No calls yet',
  dealerEmptyMessage:
    'When a signed-in customer reveals your number to call you, they appear here with their verified mobile.',
  adminEmptyMessage: 'No customer has revealed a dealership’s number yet.',
  backToEnquiries: 'Back to enquiries',
  viewCalls: 'Customer calls',
} as const;
