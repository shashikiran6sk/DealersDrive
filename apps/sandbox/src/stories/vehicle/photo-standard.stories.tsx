import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  PhotoStandardGuide,
  PhotoWalkround,
  PostureFigure,
  SHOT_GUIDES,
  ShotDiagram,
} from '@/components/vehicle/photo-standard';

const meta = {
  title: 'Vehicle/PhotoStandardGuide',
  component: PhotoStandardGuide,
  parameters: { layout: 'padded' },
  argTypes: { compact: { control: 'boolean' } },
  args: { compact: false },
} satisfies Meta<typeof PhotoStandardGuide>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullGuide: Story = {};

export const Compact: Story = { args: { compact: true } };

export const Walkround: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 24 }}>
      <PhotoWalkround className="w-[220px]" />
      <PhotoWalkround className="w-[220px]" highlight={4} done={[1, 2, 3]} />
    </div>
  ),
};

export const EveryShot: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 160px)', gap: 16 }}>
      {SHOT_GUIDES.map((shot) => (
        <figure key={shot.slot} style={{ margin: 0 }}>
          <ShotDiagram shot={shot} />
          <figcaption style={{ fontSize: 12 }}>{shot.title}</figcaption>
        </figure>
      ))}
    </div>
  ),
};

export const Postures: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 24 }}>
      <PostureFigure posture="stand" className="w-[200px]" />
      <PostureFigure posture="kneel" className="w-[200px]" />
      <PostureFigure posture="inside" className="w-[200px]" />
    </div>
  ),
};
