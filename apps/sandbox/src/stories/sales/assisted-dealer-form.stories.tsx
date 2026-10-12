import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AssistedDealerForm } from '@/features/sales/assisted-dealer-form';
import type { SalesActionResult } from '@/features/sales/sales-actions';

function saved(): Promise<SalesActionResult> {
  return Promise.resolve({ ok: true });
}

const FILLED = {
  legalName: 'Sri Murugan Cars',
  contactName: 'Murugan',
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
    submitLabel: 'Save and continue',
    partial: false,
    disabled: false,
    onSubmit: saved,
  },
  argTypes: {
    submitLabel: { control: 'text' },
    partial: { control: 'boolean', description: 'Edit sends only the fields that are filled.' },
    disabled: {
      control: 'boolean',
      description: 'Locked once the dealership is no longer a draft.',
    },
    onSubmit: { control: false },
    doneHref: {
      control: 'text',
      description: 'Where to go after a successful save — the documents step (#299).',
    },
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
    submitLabel: 'Save and continue',
    partial: true,
    doneHref: '/sales/dealers/d-1/documents',
  },
};

export const Refused: Story = {
  name: 'Server refusal, by field',
  args: {
    initial: { ...FILLED, pincode: '12' },
    onSubmit: () =>
      Promise.resolve({
        ok: false,
        message: 'Check the highlighted fields.',
        fieldErrors: { pincode: 'Enter a 6-digit pincode.' },
      }),
  },
};

export const Locked: Story = {
  name: 'Locked — submitted',
  args: { initial: FILLED, submitLabel: 'Save details', partial: true, disabled: true },
};
