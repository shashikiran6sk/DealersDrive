import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Button, ButtonLink } from '@/components/ui/button';

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

export const Loading: Story = { args: { loading: true, variant: 'primary' } };

export const Disabled: Story = { args: { disabled: true } };

export const Block: Story = {
  args: { block: true, variant: 'primary', size: 'lg' },
  parameters: { layout: 'padded' },
};

export const LongLabel: Story = {
  args: { children: 'Submit this listing for moderation review' },
};

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
