import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Avatar, Blueprint, ImageSlot, LogoTile, StatCard } from '@/components/ui/primitives';

const meta = {
  title: 'Primitives/Structure',
  component: Blueprint,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Blueprint>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BlueprintFrame: Story = {
  render: () => (
    <Blueprint className="p-6">
      <p style={{ margin: 0 }}>Count the corners: there must be four.</p>
    </Blueprint>
  ),
};

export const BlueprintAsSection: Story = {
  render: () => (
    <Blueprint as="section" className="p-6">
      <p style={{ margin: 0 }}>Rendered as &lt;section&gt;.</p>
    </Blueprint>
  ),
};

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
