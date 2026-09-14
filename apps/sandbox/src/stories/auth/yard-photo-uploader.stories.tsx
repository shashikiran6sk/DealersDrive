import type { YardPhotoDto } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { YardPhotoUploader } from '@/features/auth/yard-photo-uploader';

function photo(overrides: Partial<YardPhotoDto> = {}): YardPhotoDto {
  return {
    mediaId: null,
    status: null,
    fileName: null,
    url: null,
    uploadedAt: null,
    ...overrides,
  };
}

const meta = {
  title: 'Forms/YardPhotoUploader',
  component: YardPhotoUploader,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560, margin: '24px auto', background: '#fff', padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: { photo: { control: 'object' } },
  args: { photo: photo() },
} satisfies Meta<typeof YardPhotoUploader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Empty: Story = { args: { photo: photo() } };

export const Uploaded: Story = {
  args: {
    photo: photo({
      mediaId: '00000000-0000-4000-8000-0000000000ff',
      status: 'READY',
      fileName: 'yard-frontage.jpg',
      url: 'https://placehold.co/1200x675/1f2937/e5e7eb.png?text=Yard+frontage',
      uploadedAt: '2026-09-02T09:15:00.000Z',
    }),
  },
};

export const WidePhotograph: Story = {
  args: {
    photo: photo({
      mediaId: '00000000-0000-4000-8000-0000000000fe',
      status: 'READY',
      fileName: 'signboard-panorama.jpg',
      url: 'https://placehold.co/2400x800/0f172a/e2e8f0.png?text=Signboard',
      uploadedAt: '2026-09-02T09:15:00.000Z',
    }),
  },
};
