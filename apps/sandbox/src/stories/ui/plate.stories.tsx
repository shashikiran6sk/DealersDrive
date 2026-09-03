import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Plate } from '@/components/ui/primitives';

/**
 * The registration plate — the signature element, and it belongs in exactly
 * four places (DESIGN-SPEC §4.5): the logo, a vehicle card's year badge, the
 * verified-dealer chip, and the PRIMARY photo marker. It is never interactive.
 *
 * The four sizes below are those four places. Rendering them together is what
 * stops a fifth being invented.
 */
const meta = {
  title: 'Primitives/Plate',
  component: Plate,
  parameters: { layout: 'centered' },
  argTypes: {
    size: { control: 'inline-radio', options: ['year', 'logo', 'chip', 'marker'] },
    children: { control: 'text' },
  },
  args: { children: '2019', size: 'year' },
} satisfies Meta<typeof Plate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Each size next to the place it is used. */
export const EverySize: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <Plate size="year">2019</Plate>
      <Plate size="logo">DEALERS-DRIVE</Plate>
      <Plate size="chip">VERIFIED</Plate>
      <Plate size="marker">PRIMARY</Plate>
    </div>
  ),
};

/** The accent bar is drawn by `::before`, so it must survive a long label. */
export const LongLabel: Story = { args: { children: 'TN 09 BX 1234', size: 'logo' } };
