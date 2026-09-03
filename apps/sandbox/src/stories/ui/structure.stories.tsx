import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Avatar, Blueprint, ImageSlot, LogoTile, StatCard } from '@/components/ui/primitives';

/**
 * The structural primitives — the frame, the identity tiles, the stat card and
 * the image placeholder.
 */
const meta = {
  title: 'Primitives/Structure',
  component: Blueprint,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Blueprint>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * **All four registration marks, always.** A `.blueprint` missing a corner is
 * the one defect DESIGN-SPEC §4.4 calls out by name, so this story exists
 * specifically to make a missing corner visible.
 *
 * Reserved for: the hero search block, hero and gallery figures, body-type
 * tiles, stat and balance cards, the price block, review-summary panels, the
 * under-review panel, and empty states. Not for plain content cards.
 */
export const BlueprintFrame: Story = {
  render: () => (
    <Blueprint className="p-6">
      <p style={{ margin: 0 }}>Count the corners: there must be four.</p>
    </Blueprint>
  ),
};

/** It can render as a section or article without losing its marks. */
export const BlueprintAsSection: Story = {
  render: () => (
    <Blueprint as="section" className="p-6">
      <p style={{ margin: 0 }}>Rendered as &lt;section&gt;.</p>
    </Blueprint>
  ),
};

/**
 * `Avatar` and `LogoTile` at the sizes the product actually uses — 20 and 22
 * for avatars, 42 and 44 for logo tiles — with one, two and three letters.
 * Three letters at 20px is where the initials overflow if the font scaling
 * is wrong.
 */
export const IdentityTiles: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Avatar initials="A" size={20} />
        <Avatar initials="SK" size={20} />
        <Avatar initials="SKM" size={20} />
        <Avatar initials="A" size={22} />
        <Avatar initials="SK" size={22} />
        <Avatar initials="SKM" size={22} />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <LogoTile initials="A" size={42} />
        <LogoTile initials="VM" size={42} />
        <LogoTile initials="VMS" size={42} />
        <LogoTile initials="VM" size={44} />
      </div>
    </div>
  ),
};

/** Every delta tone, plus the long-value case that breaks the layout. */
export const Stats: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, 1fr)' }}>
      <StatCard label="Live listings" value="24" delta="+3" deltaTone="ok" />
      <StatCard label="In review" value="2" delta="+1" deltaTone="warn" />
      <StatCard label="Rejected" value="1" delta="-2" deltaTone="err" />
      <StatCard label="Credits" value="1,250" />
    </div>
  ),
};

/** A value long enough to test the clamp. */
export const StatLongValue: Story = {
  render: () => (
    <div style={{ maxWidth: 220 }}>
      <StatCard
        label="Total enquiry value this quarter"
        value="₹1,24,50,000"
        delta="+18%"
        deltaTone="ok"
      />
    </div>
  ),
};

/**
 * The fallback when a vehicle has no photograph at all. It fills its container,
 * so it is shown here at two aspect ratios.
 */
export const ImagePlaceholder: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ width: 240, height: 160 }}>
        <ImageSlot label="Front three-quarter" />
      </div>
      <div style={{ width: 120, height: 120 }}>
        <ImageSlot label="Thumbnail" />
      </div>
    </div>
  ),
};
