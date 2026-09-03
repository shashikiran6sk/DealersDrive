import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StatusTone } from '@dealers-drive/contracts';

import { Banner, StatusTag, Tag } from '@/components/ui/primitives';

/**
 * Status is never conveyed by colour alone — the label always carries it
 * (DESIGN-SPEC §4.15). Every scenario below is readable in greyscale.
 */
const meta = {
  title: 'Primitives/StatusTag',
  component: StatusTag,
  parameters: { layout: 'centered' },
  argTypes: {
    tone: { control: 'inline-radio', options: StatusTone.options },
    children: { control: 'text' },
  },
  args: { tone: 'ok', children: 'Approved' },
} satisfies Meta<typeof StatusTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * Generated from the contracts enum rather than a hand-written list, so adding
 * a `StatusTone` makes a new swatch appear here automatically — and a tone with
 * no CSS class shows up as an unstyled tag rather than passing unnoticed.
 */
export const EveryTone: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {StatusTone.options.map((tone) => (
        <StatusTag key={tone} tone={tone}>
          {tone}
        </StatusTag>
      ))}
    </div>
  ),
};

/** `Tag` is the non-status sibling: three variants, no semantic meaning. */
export const TagVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <Tag variant="neutral">Neutral</Tag>
      <Tag variant="accent">Accent</Tag>
      <Tag variant="outline">Outline</Tag>
    </div>
  ),
};

/**
 * ⚠️ `Banner.tone` and `StatusTone` are two different unions — Banner takes
 * only ok/warn/err. That divergence is finding D-G in component-map.md and is
 * deliberately **not** merged here; the two are rendered together so the
 * difference is visible rather than surprising.
 */
export const BannerTones: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
      <Banner tone="ok" title="Listing approved">
        It is live on the marketplace now.
      </Banner>
      <Banner tone="warn" title="Two photos missing">
        A listing needs at least six before it can be submitted.
      </Banner>
      <Banner tone="err" title="Payment failed">
        No credits were deducted.
      </Banner>
    </div>
  ),
};

/** All four shapes: with and without a title, with and without children. */
export const BannerShapes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
      <Banner tone="ok" title="Title and body">
        Both present.
      </Banner>
      <Banner tone="warn" title="Title only" />
      <Banner tone="err">Body only, no title.</Banner>
      <Banner tone="ok" title="With an action" action={<a href="/dealer">Open console</a>}>
        The action sits inline.
      </Banner>
    </div>
  ),
};

/** Long copy must wrap rather than push the action off the edge. */
export const BannerLongText: Story = {
  render: () => (
    <div style={{ maxWidth: 560 }}>
      <Banner
        tone="warn"
        title="This listing has been sitting in the moderation queue"
        action={<a href="/admin">Review</a>}
      >
        Submitted eleven days ago and not yet picked up by a moderator. Dealers are told to expect a
        decision within two working days, so anything past that is worth chasing.
      </Banner>
    </div>
  ),
};
