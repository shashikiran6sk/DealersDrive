import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ConsolePageLoading } from '@/components/dealer/console-page-loading';
import { DealerPageLoading } from '@/components/dealers/dealer-page-loading';
import { VehiclePageLoading } from '@/components/vehicle/vehicle-page-loading';
import { CustomerEnquiriesLoading } from '@/features/enquiry/customer-enquiries';
import { SavedListLoading } from '@/features/saved/saved-list';

const meta = {
  title: 'Primitives/PageLoading',
  component: ConsolePageLoading,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ConsolePageLoading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Console: Story = {};

export const Vehicle: Story = { render: () => <VehiclePageLoading /> };

export const Dealership: Story = { render: () => <DealerPageLoading /> };

export const MyEnquiries: Story = { render: () => <CustomerEnquiriesLoading /> };

export const SavedCars: Story = { render: () => <SavedListLoading /> };
