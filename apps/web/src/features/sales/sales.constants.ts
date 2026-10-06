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
  documentsHeading: 'Documents',
  yardHeading: 'Yard photograph',
  submitHeading: 'Submit for verification',
  submit: 'Submit for verification',
  submitted: 'Submitted. Our operations team will review it.',
  submitIntro:
    'When every section is complete, submit. An operations reviewer decides — you cannot approve your own submission.',
  lockedNotice: 'This dealership has been submitted, so its details are read-only here.',
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
