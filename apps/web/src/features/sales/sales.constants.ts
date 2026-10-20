import type { NavItem } from '@/types';

export const SALES_ROOT_HREF = '/sales';
export const SALES_NAV_LABEL = 'Sales workspace';
export const ADD_DEALERSHIP_HREF = '/sales/dealers/new';

export const SALES_NAV: NavItem[] = [
  { href: '/sales', label: 'Dashboard', short: 'Home' },
  { href: '/sales/dealers', label: 'My Dealerships', short: 'Dealers' },
  { href: ADD_DEALERSHIP_HREF, label: 'Add Dealership', short: 'Add' },
];

export const SALES_TEXT = {
  brand: 'Sales',
  addDealership: '+ Add Dealership',
  dashboardHeading: (name: string | null) => (name ? `Hello, ${name}` : 'Your dealerships'),
  dashboardIntro:
    'Dealerships you have onboarded with their owners, and how their verification is going.',
  recentHeading: 'Recent dealerships',
  viewAll: 'View all →',
  dealersHeading: 'My Dealerships',
  dealersIntro: 'Only the dealerships you assisted. Each one is owned by its dealer.',
  newHeading: 'Add a dealership',
  newIntro:
    'Do this with the dealer beside you. Their mobile number and email are each verified with a code sent to them, and become the dealer’s own sign-in.',
  empty: 'No dealerships yet. Add the first one with the dealer beside you.',
  emptyFilter: 'No dealerships in this status.',
  tabsLabel: 'Filter dealerships by status',
  phoneVerified: 'Phone verified',
  phoneUnverified: 'Phone not verified',
  emailVerified: 'Email verified',
  emailPending: 'Email pending verification',
  ownerLinked: 'Owner account linked',
  listings: (draft: number, review: number, live: number) =>
    `${String(live)} live · ${String(review)} in review · ${String(draft)} drafts`,
  backToList: '← My Dealerships',
  backToDealer: '← Business details',
  detailsHeading: 'Details',
  stepDetails: 'Step 2 of 3 · Business details',
  documentsLink: 'Documents and submission →',
  documentsStep: 'Step 3 of 3 · Documents and submission',
  documentsOptional:
    'Documents are optional for you: the dealer can upload them later from their own account.',
  documentsHeading: 'Documents (optional for you)',
  documentsIntro:
    'One Personal Identity Proof and one Business Identity Proof are needed before the dealership can be submitted for review — not to save it. Upload them only if the dealer hands them to you; otherwise the dealer adds them later from their own account.',
  verifyHeading: 'Verify now',
  repDoneTitle: 'Your part is complete',
  repPendingTitle: 'Save the business details (Step 2) to complete your part',
  repScopeNote:
    'A sales representative’s mandatory work ends once the business details (Step 2) are saved. Documents and submission are optional for you: the dealer can upload the documents and submit for verification later from their own account.',
  submitHeading: 'Submit for verification (optional)',
  submit: 'Submit for verification',
  submitted: 'Submitted. Our operations team will review it.',
  submitIntro:
    'Optional for you. When every section is complete you can submit on the dealer’s behalf, or leave it to the dealer to submit from their own account. An operations reviewer decides — you cannot approve your own submission.',
  lockedNotice: 'This dealership has been submitted, so its details are read-only here.',
  ownerNotice:
    'This dealership is no longer a draft, and the dealer manages it from their own account, so its details are read-only here.',
  missing: (labels: string) => `Still missing: ${labels}`,
  consentRecorded: (when: string) => `Dealer consent recorded ${when}`,
  statusReason: (reason: string) => `Reviewer note: ${reason}`,
} as const;

export const STATUS_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'PENDING_APPROVAL', label: 'Under review' },
  { key: 'ACTIVE', label: 'Approved' },
] as const;
