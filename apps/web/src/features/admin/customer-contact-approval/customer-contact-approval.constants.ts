export const CUSTOMER_CONTACT_TEXT = {
  heading: 'Customer contact number',
  none: 'No customer contact number is saved. Add one in the editor below to offer calls.',
  invalid: 'This is not a valid Indian mobile or landline. Correct it in the editor below first.',
  notApproved: 'Not approved for calls — customers can only send an enquiry.',
  approvedOn: (date: string) => `Approved for calls on ${date}`,
  approve: 'Approve for calls',
  hint: 'Once approved, signed-in customers see Call dealer on this dealership’s cars and each call is recorded as a lead. Changing the number in the editor withdraws the approval.',
  failed: 'We could not approve that number for calls.',
} as const;
