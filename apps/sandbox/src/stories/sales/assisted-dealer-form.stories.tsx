import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AssistedDealerForm } from '@/features/sales/assisted-dealer-form';
import type { SalesActionResult } from '@/features/sales/sales-actions';

function saved(): Promise<SalesActionResult> {
  return Promise.resolve({ ok: true });
}

const FILLED = {
  legalName: 'Sri Murugan Cars',
  contactName: 'Murugan',
  email: 'murugan.cars@example.in',
  addressLine1: '12 Gandhi Road',
  city: 'Katpadi',
  district: 'Vellore',
  pincode: '632007',
  pan: 'AAACS1429P',
};

const meta = {
  title: 'Sales/AssistedDealerForm',
  component: AssistedDealerForm,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[720px] p-[20px]">
        <Story />
      </div>
    ),
  ],
  args: {
    initial: {},
    initialServices: [],
    submitLabel: 'Create dealership',
    partial: false,
    disabled: false,
    onSubmit: saved,
  },
  argTypes: {
    submitLabel: { control: 'text' },
    partial: { control: 'boolean', description: 'Edit sends only the fields that are filled.' },
    disabled: { control: 'boolean', description: 'Locked once submitted or claimed.' },
    onSubmit: { control: false },
  },
} satisfies Meta<typeof AssistedDealerForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = { name: 'Create — empty' };

export const Edit: Story = {
  name: 'Edit — filled',
  args: {
    initial: FILLED,
    initialServices: ['FINANCE'],
    submitLabel: 'Save details',
    partial: true,
  },
};

export const Refused: Story = {
  name: 'Server refusal, by field',
  args: {
    initial: { ...FILLED, email: 'not-an-email' },
    onSubmit: () =>
      Promise.resolve({
        ok: false,
        message: 'Check the highlighted fields.',
        fieldErrors: { email: 'Enter a valid email address.' },
      }),
  },
};

export const Locked: Story = {
  name: 'Locked — submitted',
  args: { initial: FILLED, submitLabel: 'Save details', partial: true, disabled: true },
};
