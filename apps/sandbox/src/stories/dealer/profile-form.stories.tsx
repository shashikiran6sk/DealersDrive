import type { DealerProfile } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ReactElement } from 'react';

import { DealerProfileForm } from '@/features/dealer/profile-form';

import { dealerProfileStub, type ProfileFormState } from '../../mocks/dealer-actions';

/**
 * C1/C2 — the dealership's own record, after onboarding is over.
 *
 * Four things to check by eye:
 *
 *   · **What is missing from the form is the point.** There is no "Trading
 *     name": `brandName` is the server-written mirror of `legalName`, and two
 *     boxes able to disagree is exactly what leaving it out prevents. GSTIN and
 *     PAN render disabled — they were verified against a document, and the
 *     admin review screen is where a correction belongs.
 *   · **City, district, state and the Maps link are typed and editable**
 *     (D6, R2, R6). They were a dropdown over a five-row table and two disabled
 *     mirrors of it, which meant a dealer in Salem could not finish this form.
 *   · **The mobile is editable** (R7), and shows the raw number rather than the
 *     `+91 98400 12345` display form, because raw is what the field accepts
 *     back.
 *   · **A refusal lands on the box it names.** `ServerRefusal` below is the
 *     API's answer to a duplicate dealership name in one city and a Maps link
 *     that is not a Google host — the two most likely real failures.
 *
 * The Server Action is stubbed — `src/mocks/dealer-actions.ts`, coupling C-4.
 * The stub waits 900ms so the save button's loading state is visible.
 */
const BASE: DealerProfile = {
  id: '3c8f2b10-2222-4000-8000-000000000002',
  slug: 'sri-lakshmi-motors',
  status: 'ACTIVE',
  statusLabel: 'Active',
  statusReason: null,
  brandName: 'Sri Lakshmi Motors',
  legalName: 'Sri Lakshmi Motors Pvt Ltd',
  tagline: 'Hatchbacks under ₹6 lakh, inspected in-house',
  gstin: '33AABCS1429B1ZX',
  pan: 'AABCS1429B',
  contact: {
    fullName: 'Ramesh Kumar',
    roleTitle: 'Owner',
    phone: '9840012345',
    phoneDisplay: '+91 98400 12345',
    email: 'owner@sri-lakshmi-motors.in',
    landline: '0416 224 8890',
  },
  address: {
    line: '12 Katpadi Road',
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
    pincode: '632001',
    mapsUrl: 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
    mapKind: 'PLACE',
  },
  specialities: ['Hatchbacks', 'RC transfer', 'Exchange'],
  workingHours: { mon_sat: '09:30-20:00', sun: null },
  establishedYear: 1998,
  logoMediaId: null,
  coverMediaId: null,
  creditBalance: 39,
  creditsHeld: 2,
  activeListings: 7,
  approvedAt: '2026-01-14T06:12:00.000Z',
  createdAt: '2025-12-01T09:00:00.000Z',
};

/**
 * Setting the stub in a decorator rather than in `beforeEach`, to match the
 * idiom the admin and auth stories already use: it runs on every re-render, so
 * a control change cannot leave the previous story's stub in place.
 */
function stub(delayMs: number, result: ProfileFormState) {
  return function withStub(Story: () => ReactElement) {
    dealerProfileStub.delayMs = delayMs;
    dealerProfileStub.result = result;
    dealerProfileStub.calls = [];
    return <Story />;
  };
}

const meta: Meta<typeof DealerProfileForm> = {
  title: 'Dealer/DealerProfileForm',
  component: DealerProfileForm,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[900px]">
        <Story />
      </div>
    ),
  ],
};

const SAVED: ProfileFormState = { status: 'saved', fieldErrors: {} };

export default meta;
type Story = StoryObj<typeof DealerProfileForm>;

/** A dealership that finished onboarding and has answered everything. */
export const Populated: Story = {
  args: { dealer: BASE },
  decorators: [stub(900, SAVED)],
};

/**
 * A row that predates R2 and R6 — no district, no Maps link — and never wrote a
 * tagline or a service list. Every optional box is empty, which is what the
 * completeness meter on the page is counting.
 */
export const Sparse: Story = {
  args: {
    dealer: {
      ...BASE,
      status: 'PENDING_APPROVAL',
      statusLabel: 'Pending verification',
      tagline: null,
      specialities: [],
      establishedYear: null,
      workingHours: null,
      contact: { ...BASE.contact, roleTitle: null, email: null, landline: null },
      address: { ...BASE.address, line: null, district: null, mapsUrl: null, mapKind: 'NONE' },
    },
  },
  decorators: [stub(900, SAVED)],
};

/**
 * **R20** — the same saved link, drawing a bare pin instead of a listing.
 *
 * This is the state the note exists for, and it is not an edge case: the Share
 * sheet on a phone hands out the same shape of short link whether the dealer
 * opened their *business card* first or dropped a pin on their street, and the
 * box looks identical afterwards. `Populated` is the good case (`PLACE`, in the
 * ok green); this is the one that tells a dealer what to do about it.
 */
export const MapIsOnlyAPin: Story = {
  args: { dealer: { ...BASE, address: { ...BASE.address, mapKind: 'POINT' } } },
  decorators: [stub(900, SAVED)],
};

/** A link we could not read a position out of at all — the third answer. */
export const MapCouldNotBeRead: Story = {
  args: { dealer: { ...BASE, address: { ...BASE.address, mapKind: 'NONE' } } },
  decorators: [stub(900, SAVED)],
};

/**
 * The form after a successful save. `useActionState` holds this until the next
 * submit — the banner is not auto-dismissed (DESIGN-SPEC §2.15).
 */
export const Saved: Story = {
  args: { dealer: BASE },
  decorators: [stub(0, SAVED)],
};

/**
 * Two field-level refusals, in the API's own vocabulary. `address.mapsUrl` and
 * `legalName` come back as `body.address.mapsUrl` and `body.legalName`; the
 * action folds them onto the input names, which is what puts the message under
 * the right box.
 */
export const ServerRefusal: Story = {
  args: { dealer: BASE },
  decorators: [
    stub(0, {
      status: 'error',
      fieldErrors: {
        legalName: 'Another dealership in Vellore already trades under this name.',
        addressMapsUrl: 'That does not look like a Google Maps link.',
      },
    }),
  ],
};

/** A 5xx, or anything the API refused without naming a field. */
export const ServerError: Story = {
  args: { dealer: BASE },
  decorators: [
    stub(0, {
      status: 'error',
      fieldErrors: {},
      message: 'Something went wrong at our end. Please try again.',
    }),
  ],
};

/** The save button mid-flight — the stub waits three seconds. */
export const Saving: Story = {
  args: { dealer: BASE },
  decorators: [stub(3000, SAVED)],
};
