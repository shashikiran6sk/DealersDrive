import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { VehicleOptionSelect } from '@/components/forms/vehicle-option-select';
import { IdentityFields } from '@/features/vehicle/vehicle-wizard/identity-fields';

const IN_USE: Record<string, string[]> = {
  'model|Hyundai|': ['Creta', 'i20', 'Venue', 'Verna', 'Grand i10 Nios', 'Exter', 'Alcazar'],
  'model|Maruti Suzuki|': ['Swift', 'Baleno', 'Dzire', 'Brezza', 'Ertiga', 'Wagon R', 'Alto K10'],
  'model|Tata|': ['Nexon', 'Punch', 'Tiago', 'Altroz', 'Harrier'],
  'variant|Hyundai|Creta': ['SX(O)', 'SX', 'S', 'EX', 'E'],
  'variant|Maruti Suzuki|Swift': ['VXi', 'ZXi', 'ZXi Plus', 'LXi'],
};

let failing = false;

function fakeSuggestions(): () => void {
  const real = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (!url.includes('/api/dealer/vehicles/suggestions')) return real(input, init);
    if (failing) return Promise.resolve(new Response('{}', { status: 502 }));
    const params = new URL(url, window.location.origin).searchParams;
    const field = params.get('field') ?? 'model';
    const key = `${field}|${params.get('make') ?? ''}|${params.get('model') ?? ''}`;
    const body = JSON.stringify({ field, values: IN_USE[key] ?? [] });
    return new Promise<Response>((resolve) => {
      setTimeout(() => resolve(new Response(body, { status: 200 })), 150);
    });
  };
  return () => {
    window.fetch = real;
    failing = false;
  };
}

const meta = {
  title: 'Forms/VehicleOptionSelect',
  component: VehicleOptionSelect,
  parameters: { layout: 'padded' },
  beforeEach: fakeSuggestions,
  argTypes: {
    field: { control: 'select', options: ['model', 'variant'] },
    make: { control: 'select', options: ['', 'Hyundai', 'Maruti Suzuki', 'Tata', 'Force Motors'] },
    model: { control: 'text' },
    defaultValue: { control: 'text' },
    placeholder: { control: 'text' },
    required: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: { id: 'model', field: 'model', make: 'Hyundai', placeholder: 'Creta', required: true },
  render: (args) => (
    <div style={{ maxWidth: 360, minHeight: 360 }}>
      <label htmlFor={args.id} style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
        {args.field === 'model' ? 'Model' : 'Variant'}
      </label>
      <VehicleOptionSelect key={`${args.make}:${args.model ?? ''}`} {...args} />
    </div>
  ),
} satisfies Meta<typeof VehicleOptionSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ModelsUnderAMake: Story = {};

export const VariantsUnderAModel: Story = {
  args: { id: 'variant', field: 'variant', model: 'Creta', placeholder: 'SX(O)', required: false },
};

export const Prefilled: Story = { args: { defaultValue: 'Venue' } };

export const WaitingForTheMake: Story = { args: { make: '' } };

export const NothingListedYet: Story = { args: { make: 'Force Motors', placeholder: 'Gurkha' } };

export const ListCannotLoad: Story = {
  beforeEach: () => {
    failing = true;
  },
};

export const Disabled: Story = { args: { defaultValue: 'Creta', disabled: true } };

export const MakeModelVariant: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gap: 14,
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        maxWidth: 720,
        minHeight: 380,
      }}
    >
      <IdentityFields errors={{}} initial={{ make: 'Hyundai', model: '', variant: '' }} />
    </div>
  ),
};
