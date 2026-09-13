import type { ConfigEntry } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ConfigRow } from '@/features/admin/config-editor';

import { configActionStub } from '../../mocks/config-actions';

/**
 * D14 (C064) — one platform setting, one control, one save.
 *
 * **The declared type picks the control.** `number` gets a numeric input,
 * `boolean` a two-option select, `string[]` a textarea read one entry per line.
 * That is not cosmetic: these values govern money and moderation, and the
 * server refuses a value that is not the type the key declares — so the control
 * that cannot produce a wrong type is the first half of that guard.
 *
 * **`readBy` decides whether there is a control at all**, and it is the state
 * worth looking at hardest. The settings table holds every knob the product
 * will ever have; most of the code that consults them has not been
 * reconstructed. A key nothing reads renders as a value and a tag, because an
 * editable field that saves and changes nothing has told the operator they
 * changed something.
 *
 * Save is disabled until the value differs from the stored one — a save that
 * writes the same number is an audit row that says nothing happened.
 *
 * The Server Action is stubbed (`src/mocks/config-actions.ts`, coupling C-4),
 * and deliberately slow so the pending button is visible.
 */
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

/** A number, and the only type on this screen that is also money. */
export const Number: Story = { args: { entry: entry() } };

/**
 * A flag. Two options rather than a checkbox, because "Enabled / Disabled" is
 * what the operator is choosing between — a tick box makes them infer it.
 */
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

/** One entry per line, and the hint under the box says so. */
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

/**
 * **The placeholder.** Nothing reads this key yet, so there is a value and a
 * tag and no control. Compare it with `Number` above: the difference is one
 * field on the API response, and it is the difference between a screen that
 * tells the truth and one that does not.
 */
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

/** Changed but not yet saved — Save is live only from here. */
export const Dirty: Story = {
  args: { entry: entry() },
  parameters: {
    docs: { description: { story: 'Type a different number to see Save become available.' } },
  },
};

/** The server refused it. The row keeps the typed value so it can be corrected. */
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

/** Mid-save. The stub delays 700ms so this is a state you can look at. */
export const Saving: Story = {
  args: { entry: entry() },
  decorators: [
    (Story) => {
      configActionStub.delayMs = 8000;
      return <Story />;
    },
  ],
};

/** A setting that has been changed before, with the date it last moved. */
export const PreviouslyChanged: Story = {
  args: { entry: entry({ updatedAt: '2026-08-30T09:12:00.000Z' }) },
};
