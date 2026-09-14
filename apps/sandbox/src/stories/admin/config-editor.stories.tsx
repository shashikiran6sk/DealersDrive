import type { ConfigEntry } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ConfigRow } from '@/features/admin/config-editor';

import { configActionStub } from '../../mocks/config-actions';

function entry(overrides: Partial<ConfigEntry> = {}): ConfigEntry {
  return {
    key: 'billing.gstPercent',
    label: 'GST percent',
    type: 'number',
    value: 18,
    updatedAt: null,
    readBy: "the admin console's revenue figure",
    ...overrides,
  };
}

const meta = {
  component: ConfigRow,
  title: 'Admin/ConfigRow',
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => {
      configActionStub.delayMs = 700;
      configActionStub.result = { ok: true };
      return (
        <div
          style={{ maxWidth: 860, border: '1px solid var(--color-divider)', background: '#fff' }}
        >
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<typeof ConfigRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Number: Story = { args: { entry: entry() } };

export const Boolean_: Story = {
  name: 'Boolean',
  args: {
    entry: entry({
      key: 'feature.similarCars',
      label: 'Similar cars on the detail page',
      type: 'boolean',
      value: true,
      readBy: 'GET /v1/config/public',
    }),
  },
};

export const StringList: Story = {
  args: {
    entry: entry({
      key: 'listing.rejectionReasonPresets',
      label: 'Rejection reason presets',
      type: 'string[]',
      value: [
        'Photos are too few or too poor to represent the vehicle.',
        'Price is implausible for this model, year and condition.',
      ],
      readBy: 'the moderation queue',
    }),
  },
};

export const NothingReadsItYet: Story = {
  args: {
    entry: entry({
      key: 'reveal.dailyCapPerIp',
      label: 'Phone reveals per day per IP',
      value: 20,
      readBy: null,
    }),
  },
};

export const Dirty: Story = {
  args: { entry: entry() },
  parameters: {
    docs: { description: { story: 'Type a different number to see Save become available.' } },
  },
};

export const ServerRefusal: Story = {
  args: { entry: entry() },
  decorators: [
    (Story) => {
      configActionStub.result = {
        ok: false,
        message: 'billing.gstPercent is a number, and this value is not one.',
      };
      return <Story />;
    },
  ],
};

export const Saving: Story = {
  args: { entry: entry() },
  decorators: [
    (Story) => {
      configActionStub.delayMs = 8000;
      return <Story />;
    },
  ],
};

export const PreviouslyChanged: Story = {
  args: { entry: entry({ updatedAt: '2026-08-30T09:12:00.000Z' }) },
};
