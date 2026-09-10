import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Field, invalidProps } from '@/components/forms/field';
import { ServiceInput } from '@/components/ui/service-input';

/**
 * C072 — the services list, entered one service at a time (**R37**).
 *
 * `specialities` is an array in the contract and was a comma-separated text box
 * on both screens that write it. That asked the dealer to hold a serialisation
 * format in their head, and hid the one fact they most need to see: **how many
 * services they have named, and which**.
 *
 * Buyers already read this list as chips, on the directory card (`DealerCard`,
 * C0xx) and on the portfolio; so does the admin review screen. This makes the
 * editor the same picture — what the dealer is building is what a buyer will
 * see, down to the first chip taking the accent (**R29**).
 *
 * ── Four things to check by eye ─────────────────────────────────────────────
 *
 *   · **Type and press Add, or just press Enter.** Enter must *not* submit the
 *     surrounding form — on onboarding that would skip a step.
 *   · **Paste a comma-separated line.** `Finance, Exchange, RC transfer` should
 *     land as three chips, not one. A dealer copying their list out of WhatsApp
 *     is the case this exists for.
 *   · **Add something twice, in different case.** `RC transfer` and
 *     `rc TRANSFER` are one service; the second is refused with a message and
 *     the box keeps what was typed, because there is nothing to retype.
 *   · **Fill it to twelve.** The box and the button shut, and the placeholder
 *     says why — a limit enforced at the point of entry rather than discovered
 *     on save.
 *
 * ── How it submits ──────────────────────────────────────────────────────────
 * A hidden input carries `services.join(', ')` under `name`, which is exactly
 * what the old box submitted. `servicesOf()` in the server actions is unchanged
 * and is still the single parse. The visible box has **no `name`**: it is the
 * draft, not the value, and a draft must not be submittable.
 *
 * A service typed but not added is still committed on submit — see the
 * `useEffect` in the component. Without that, the most natural mistake on the
 * screen (type, press Continue) silently loses the last entry.
 */
const meta = {
  title: 'Forms/ServiceInput',
  component: ServiceInput,
  parameters: { layout: 'padded' },
  argTypes: {
    value: { control: 'object' },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    max: { control: { type: 'number', min: 1, max: 24 } },
    maxLength: { control: { type: 'number', min: 8, max: 120 } },
  },
  args: {
    id: 'specialities',
    name: 'specialities',
    value: [],
    placeholder: 'In-house workshop',
  },
  decorators: [
    (Story) => (
      // A `<form>`, because two of the component's rules are about one: Enter
      // must not submit it, and an uncommitted draft must be committed when it
      // does. Neither is observable outside a form.
      <form
        style={{ maxWidth: 520 }}
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <Story />
      </form>
    ),
  ],
} satisfies Meta<typeof ServiceInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A dealership that has not named a service yet — onboarding's opening state. */
export const Empty: Story = {};

/** One. The accent is on it, as it is on the first chip of a directory card. */
export const OneService: Story = { args: { value: ['In-house workshop'] } };

/**
 * The common shape. Three is what a directory card shows, so this is the row a
 * buyer is most likely to actually read.
 */
export const ThreeServices: Story = {
  args: { value: ['In-house workshop', 'RC transfer assistance', 'Bank loan tie-ups'] },
};

/**
 * Long labels, wrapping. `Tag` sets `white-space: nowrap`, so the wrap happens
 * between chips and never inside one — which is what keeps the row legible at
 * 375px rather than producing a column of broken words.
 */
export const WrappingToTwoRows: Story = {
  args: {
    value: [
      'In-house workshop',
      'RC transfer assistance',
      'Bank loan tie-ups',
      'Insurance renewal',
      'Exchange',
      'Doorstep test drive',
    ],
  },
};

/** At the ceiling: the box and the button are shut and the placeholder says why. */
export const AtTheLimit: Story = {
  args: { value: Array.from({ length: 12 }, (_, index) => `Service ${String(index + 1)}`) },
};

/**
 * **R34** — an edit waiting for a moderator. The box is shut on the proposed
 * list and the chips carry no remove control, because the way out of this state
 * is withdrawing the whole change rather than editing it in place.
 */
export const WaitingForReview: Story = {
  args: { value: ['SUVs', 'Exchange', 'Bank loan tie-ups'], disabled: true },
};

/**
 * Inside its `Field`, refused by the server. The message is wired to the draft
 * box by `aria-describedby`, so the control a screen reader lands on is the one
 * that carries the explanation.
 */
export const Invalid: Story = {
  render: (args) => (
    <Field
      id="specialities"
      label="Services you offer"
      hint="one at a time, up to 12"
      error="Name at least one service you offer."
    >
      <ServiceInput
        {...args}
        {...invalidProps('specialities', 'Name at least one service you offer.')}
      />
    </Field>
  ),
  args: { value: [], required: true },
};
