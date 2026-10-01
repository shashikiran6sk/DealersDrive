import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AdminDetailLoading, AdminListLoading } from '@/components/admin/admin-list-loading';

const meta = {
  title: 'Admin/AdminListLoading',
  component: AdminListLoading,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminListLoading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = {};

export const Detail: Story = { render: () => <AdminDetailLoading /> };
