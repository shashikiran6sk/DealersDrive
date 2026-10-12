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
    'Do this with the dealer beside you. Their phone is verified with a code sent to them; their email stays unverified until they confirm it themselves.',
  empty: 'No dealerships yet. Add the first one with the dealer beside you.',
  emptyFilter: 'No dealerships in this status.',
  tabsLabel: 'Filter dealerships by status',
  phoneVerified: 'Phone verified',
  phoneUnverified: 'Phone not verified',
  emailVerified: 'Email verified',
  emailPending: 'Email pending verification',
  claimed: 'Claimed by dealer',
  listings: (draft: number, review: number, live: number) =>
    `${String(live)} live · ${String(review)} in review · ${String(draft)} drafts`,
  backToList: '← My Dealerships',
  detailsHeading: 'Details',
  emailHeading: 'Email verification and claim',
  documentsHeading: 'Documents (optional for you)',
  documentsIntro:
    'One Personal Identity Proof and one Business Identity Proof are needed before the dealership can be submitted for review — not to save it. Upload them only if the dealer hands them to you; otherwise the dealer adds them after claiming the account.',
  repDoneTitle: 'Your part is complete',
  repPendingTitle: 'Save the business details (Step 2) to complete your part',
  repScopeNote:
    'A sales representative’s mandatory work ends once the business details (Step 2) are saved. Documents and submission are optional for you: the dealer can upload the documents and submit for verification after claiming the account.',
  submitHeading: 'Submit for verification (optional)',
  submit: 'Submit for verification',
  submitted: 'Submitted. Our operations team will review it.',
  submitIntro:
    'Optional for you. When every section is complete you can submit on the dealer’s behalf, or leave it to the dealer after they claim the account. An operations reviewer decides — you cannot approve your own submission.',
  lockedNotice: 'This dealership has been submitted, so its details are read-only here.',
  claimedNotice:
    'The dealer has claimed this dealership and manages it from their own account, so its details are read-only here.',
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
