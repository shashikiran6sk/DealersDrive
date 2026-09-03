import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Button, ButtonLink } from '@/components/ui/button';

/**
 * The component 75 % of the product's buttons currently bypass — 29 uses of
 * `<Button>` against 88 raw `className="btn …"` sites. Every variant and size
 * is rendered below so there is never a reason to hand-roll one.
 */
const meta = {
  title: 'Primitives/Button',
  component: Button,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'ghost', 'destructive', 'danger'],
    },
    size: { control: 'inline-radio', options: ['default', 'sm', 'md', 'lg', 'hero'] },
    block: { control: 'boolean' },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    children: { control: 'text' },
  },
  args: { children: 'Save changes', variant: 'secondary', size: 'default' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** All five variants together — the whole vocabulary in one look. */
export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
};

/** Five sizes, each named for where it is used. */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Button size="sm">sm — in-card</Button>
      <Button size="default">default — toolbar</Button>
      <Button size="md">md — onboarding</Button>
      <Button size="lg">lg — VDP CTA</Button>
      <Button size="hero">hero — search</Button>
    </div>
  ),
};

/** `loading` implies `disabled` and sets `aria-busy`. */
export const Loading: Story = { args: { loading: true, variant: 'primary' } };

export const Disabled: Story = { args: { disabled: true } };

/** Full width, for sheets and the auth form. */
export const Block: Story = {
  args: { block: true, variant: 'primary', size: 'lg' },
  parameters: { layout: 'padded' },
};

/** Long labels must not clip or wrap mid-word. */
export const LongLabel: Story = {
  args: { children: 'Submit this listing for moderation review' },
};

/**
 * `ButtonLink` renders an anchor with identical styling — for navigation, where
 * a `<button>` would break middle-click and open-in-new-tab.
 */
export const AsLink: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12 }}>
      <ButtonLink href="/cars" variant="primary">
        Browse cars
      </ButtonLink>
      <ButtonLink href="/dealers">Find a dealer</ButtonLink>
    </div>
  ),
};
