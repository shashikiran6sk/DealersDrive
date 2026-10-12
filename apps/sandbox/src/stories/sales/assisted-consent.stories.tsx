import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { AssistedConsent } from '@/features/sales/assisted-consent';

function Harness({ initial, disabled }: { initial: boolean; disabled: boolean }) {
  const [checked, setChecked] = useState(initial);
  return (
    <div className="mx-auto max-w-[560px] p-[20px]">
      <AssistedConsent id="consent" checked={checked} disabled={disabled} onChange={setChecked} />
    </div>
  );
}

const meta = {
  title: 'Sales/AssistedConsent',
  component: Harness,
  args: { initial: false, disabled: false },
  argTypes: {
    initial: { control: 'boolean', description: 'Whether the box starts ticked.' },
    disabled: { control: 'boolean', description: 'Locked once the phone is verified.' },
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotYetAgreed: Story = {};

export const AgreedAndLocked: Story = { args: { initial: true, disabled: true } };
