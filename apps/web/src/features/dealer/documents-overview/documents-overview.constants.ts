export const DOCUMENTS_HREF = '/dealer/documents';

export const DOCUMENTS_TEXT = {
  title: 'Documents',
  heading: 'Your documents',
  intro: 'One identity proof and one business proof. Our team reviews each.',
  verified: 'Your documents are verified.',
  notUploaded: 'Not uploaded yet',
  outstandingTitle: (labels: readonly string[]) => `Still needed: ${labels.join(' and ')}`,
  activeExplanation: 'Your dealership is live. Upload these so we can verify it.',
  reminderTitle: 'Upload your documents for review',
  reminderBody: (labels: readonly string[]) => `Still to be verified: ${labels.join(', ')}.`,
  reminderAction: 'Upload documents',
} as const;
