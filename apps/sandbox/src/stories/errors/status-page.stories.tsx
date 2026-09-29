import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { RouteError } from '@/components/errors/route-error';
import { NotFoundState, StatusPage } from '@/components/errors/status-page';
import { ButtonLink } from '@/components/ui/button';

const meta = {
  title: 'Errors/StatusPage',
  component: StatusPage,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
  args: {
    code: '404',
    title: 'Page not found',
    description: 'The page you’re looking for doesn’t exist or may have been moved.',
    actions: (
      <ButtonLink href="/" variant="primary" size="lg">
        Go to homepage
      </ButtonLink>
    ),
  },
} satisfies Meta<typeof StatusPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const NotFound: Story = { render: () => <NotFoundState /> };

export const ServerError: Story = {
  render: () => (
    <RouteError
      error={Object.assign(new Error('never shown'), { digest: '2417890331' })}
      reset={() => undefined}
    />
  ),
};

export const RouteSpecificMessage: Story = {
  render: () => (
    <RouteError
      error={new Error('never shown')}
      reset={() => undefined}
      description="We couldn’t load this car right now. Please try again."
    />
  ),
};

export const PhoneWidth: Story = {
  render: () => <NotFoundState />,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
