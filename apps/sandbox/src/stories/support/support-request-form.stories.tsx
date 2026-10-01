import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SupportRequestForm } from '@/features/support/support-requests';

import { SUPPORT_ENQUIRY } from './support-requests.stories';

const meta = {
  title: 'Support/SupportRequestForm',
  component: SupportRequestForm,
  parameters: { layout: 'padded' },
  args: { enquiries: [SUPPORT_ENQUIRY] },
} satisfies Meta<typeof SupportRequestForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const AboutAnEnquiry: Story = {
  args: { initialCategory: 'ENQUIRY_ISSUE', initialEnquiryId: SUPPORT_ENQUIRY.id },
};

export const NoEnquiriesYet: Story = {
  args: { enquiries: [], initialCategory: 'DEALER_ISSUE' },
};

export const Refused: Story = {
  args: {
    initialCategory: 'GENERAL_QUESTION',
    submit: () =>
      Promise.resolve({
        status: 'refused',
        message: 'You have sent a lot of support messages. Try again in a little while.',
      }),
  },
};

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
