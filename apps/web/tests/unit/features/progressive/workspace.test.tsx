import type {
  DealerProfile,
  ProgressiveState,
  CompletenessResponse,
  DealerDocumentDto,
} from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ProgressiveWorkspace } from '../../../../src/features/progressive/workspace.js';
import { ProgressiveAdminReview } from '../../../../src/features/progressive/admin-review.js';
const progressive: ProgressiveState = {
  dealerId: '11111111-1111-4111-8111-111111111111',
  stage: 'ACTIVATE',
  registeredAt: '2026-10-11T00:00:00Z',
  consentVersion: 'synthetic-consent',
  version: 1,
  classificationReviewed: true,
  requiredDocuments: ['ADDRESS_PROOF'],
  canSubmit: false,
  canActivate: false,
};
const dealer: DealerProfile = {
  id: progressive.dealerId,
  slug: 'synthetic-business',
  status: 'ACTIVE',
  statusLabel: 'Approved',
  statusReason: null,
  brandName: 'Synthetic Business',
  legalName: 'Synthetic Business',
  tagline: null,
  gstin: null,
  pan: null,
  contact: {
    fullName: 'Synthetic Representative',
    phone: '',
    phoneDisplay: '',
    email: null,
    landline: null,
  },
  address: {
    line: 'Synthetic address',
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
    pincode: '632001',
    mapsUrl: null,
    mapKind: 'NONE',
  },
  specialities: [],
  workingHours: null,
  establishedYear: null,
  logoMediaId: null,
  coverMediaId: null,
  creditBalance: 0,
  creditsHeld: 0,
  activeListings: 0,
  approvedAt: '2026-10-11T00:00:00Z',
  createdAt: '2026-10-11T00:00:00Z',
  profileChange: null,
};
const documents: DealerDocumentDto[] = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    type: 'ADDRESS_PROOF',
    label: 'Address proof',
    status: 'VERIFIED',
    statusLabel: 'Verified',
    fileName: 'synthetic.pdf',
    uploadedAt: '2026-10-11T00:00:00Z',
    rejectionReason: null,
    action: 'Replace',
  },
];
const completeness: CompletenessResponse = {
  isComplete: true,
  canSubmit: false,
  percent: 100,
  steps: [],
};
it('shows approved evidence without implying document mutations remain available', () => {
  render(
    <ProgressiveWorkspace
      progressive={progressive}
      dealer={dealer}
      documents={documents}
      completeness={completeness}
    />,
  );
  expect(screen.getByText('Approved for permitted marketplace activities.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Business address')).toBeDisabled();
});
it('keeps submitted evidence read-only while activation is pending', () => {
  render(
    <ProgressiveWorkspace
      progressive={progressive}
      dealer={{ ...dealer, status: 'PENDING_APPROVAL' }}
      documents={documents}
      completeness={completeness}
    />,
  );
  expect(screen.getByText(/Submitted\. Our team/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument();
});
it('does not offer a verification mutation to an unauthorized reviewer', () => {
  render(<ProgressiveAdminReview progressive={progressive} editable={false} />);
  expect(
    screen.queryByRole('button', { name: 'Record applicable review' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Reviewed business classification')).not.toBeInTheDocument();
});
