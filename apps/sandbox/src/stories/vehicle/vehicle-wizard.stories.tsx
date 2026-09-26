import type { DealerVehicle } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { VehicleWizard } from '@/features/vehicle/vehicle-wizard';

const COMPLETE: DealerVehicle = {
  id: '22222222-2222-4222-8222-222222222222',
  title: '2023 Hyundai Creta SX(O)',
  registrationNumber: 'KA01AB1234',
  registrationDisplay: 'KA 01 AB 1234',
  rtoCode: 'KA01',
  make: 'Hyundai',
  model: 'Creta',
  variant: 'SX(O)',
  manufacturingYear: 2023,
  registrationYear: 2023,
  fuelType: 'PETROL',
  transmission: 'AUTOMATIC',
  bodyType: 'SUV',
  kilometersDriven: 22_400,
  ownerCount: 1,
  color: 'Polar White',
  insuranceType: 'COMPREHENSIVE',
  insuranceValidUntil: '2027-03-31',
  pricePaise: 145_000_000,
  priceLabel: '₹14,50,000',
  negotiability: 'FIXED',
  description: 'Single owner, full service history at the authorised workshop.',
  summary: 'Petrol · Automatic · 22,400 km',
  issues: [],
  complete: true,
  listing: {
    id: '33333333-3333-4333-8333-333333333333',
    status: 'DRAFT',
    statusLabel: 'Draft',
    statusTone: 'neutral',
    reason: null,
    submittedAt: null,
    publishedAt: null,
    canEdit: true,
    canSubmit: true,
    canDelete: true,
  },
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const DRAFT: DealerVehicle = {
  ...COMPLETE,
  title: 'KA 01 AB 1234',
  make: null,
  model: null,
  variant: null,
  manufacturingYear: null,
  registrationYear: null,
  fuelType: null,
  transmission: null,
  bodyType: null,
  kilometersDriven: null,
  ownerCount: null,
  color: null,
  insuranceType: null,
  insuranceValidUntil: null,
  pricePaise: null,
  priceLabel: null,
  negotiability: null,
  description: null,
  summary: '',
  complete: false,
  issues: [
    { field: 'make', message: 'Make is required.' },
    { field: 'kilometersDriven', message: 'Kilometres driven is required.' },
    { field: 'pricePaise', message: 'Price is required.' },
  ],
};

const meta = {
  title: 'Vehicle/VehicleWizard',
  component: VehicleWizard,
  parameters: { layout: 'padded' },
  argTypes: {
    step: {
      control: 'select',
      options: ['registration', 'basics', 'details', 'pricing', 'review'],
    },
    saved: { control: 'boolean' },
  },
  args: { step: 'registration', vehicle: null },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 860 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VehicleWizard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewRegistration: Story = {};

export const BasicsEmpty: Story = { args: { step: 'basics', vehicle: DRAFT } };

export const BasicsFilled: Story = { args: { step: 'basics', vehicle: COMPLETE } };

export const Details: Story = { args: { step: 'details', vehicle: COMPLETE } };

export const Pricing: Story = { args: { step: 'pricing', vehicle: COMPLETE } };

export const DraftSaved: Story = { args: { step: 'details', vehicle: DRAFT, saved: true } };

export const ReviewComplete: Story = { args: { step: 'review', vehicle: COMPLETE } };

export const ReviewIncomplete: Story = { args: { step: 'review', vehicle: DRAFT } };

export const UnderReview: Story = {
  args: {
    step: 'basics',
    vehicle: {
      ...COMPLETE,
      listing: {
        ...COMPLETE.listing,
        status: 'PENDING_REVIEW',
        statusLabel: 'Pending review',
        statusTone: 'warn',
        canEdit: false,
        canSubmit: false,
        canDelete: false,
      },
    },
  },
};

export const ChangesRequested: Story = {
  args: {
    step: 'details',
    vehicle: {
      ...COMPLETE,
      listing: {
        ...COMPLETE.listing,
        status: 'CHANGES_REQUESTED',
        statusLabel: 'Changes requested',
        statusTone: 'warn',
        reason: 'The odometer reading does not match what our photographer saw: 32,400 km.',
        canDelete: false,
      },
    },
  },
};

export const Submitted: Story = {
  args: {
    step: 'review',
    submitted: true,
    vehicle: {
      ...COMPLETE,
      listing: {
        ...COMPLETE.listing,
        status: 'PENDING_REVIEW',
        statusLabel: 'Pending review',
        statusTone: 'warn',
        canEdit: false,
        canSubmit: false,
        canDelete: false,
      },
    },
  },
};
