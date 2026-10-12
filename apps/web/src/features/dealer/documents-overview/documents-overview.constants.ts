export const DOCUMENTS_HREF = '/dealer/documents';

export const DOCUMENTS_TEXT = {
  title: 'Documents',
  heading: 'Your documents',
  intro:
    'Every dealership keeps one Personal Identity Proof and one Business Identity Proof on file. Our team reviews each one before it counts as verified.',
  verified: 'Your documents are verified.',
  notUploaded: 'Not uploaded yet',
  outstandingTitle: 'Documents still to be verified',
  outstandingLead: 'Upload these for review:',
  activeExplanation:
    'Your dealership is live, but its documents have not all been verified. A dealership activated before its documents were verified can have that activation withdrawn if they cannot be produced.',
  dealerVerifiedNote:
    'Dealer Verified is a separate review. Once both documents are verified, our team can consider your dealership for the badge.',
  reminderTitle: 'Upload your documents for review',
  reminderBody: (labels: readonly string[]) => `Still to be verified: ${labels.join(', ')}.`,
  reminderAction: 'Upload documents',
} as const;
