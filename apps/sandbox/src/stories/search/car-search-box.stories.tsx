import type { CarSuggestResponse } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect } from 'react';

import { CarSearchBox } from '@/components/search/car-search-box';

const ROWS: CarSuggestResponse['data'] = [
  {
    kind: 'BRAND',
    label: 'Hyundai',
    metaLabel: 'Brand · 12 cars',
    brand: 'hyundai',
    model: null,
    variant: null,
    count: 12,
  },
  {
    kind: 'MODEL',
    label: 'Hyundai Creta',
    metaLabel: 'Model · 5 cars',
    brand: 'hyundai',
    model: 'creta',
    variant: null,
    count: 5,
  },
  {
    kind: 'MODEL',
    label: 'Hyundai i20',
    metaLabel: 'Model · 4 cars',
    brand: 'hyundai',
    model: 'i20',
    variant: null,
    count: 4,
  },
  {
    kind: 'VARIANT',
    label: 'Hyundai Creta SX(O)',
    metaLabel: 'Variant · 2 cars',
    brand: 'hyundai',
    model: 'creta',
    variant: 'SX(O)',
    count: 2,
  },
];

type Behaviour =
  { kind: 'rows'; delayMs?: number } | { kind: 'empty' } | { kind: 'never' } | { kind: 'fails' };

function useFakeSuggestEndpoint(behaviour: Behaviour): void {
  useEffect(() => {
    const real = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (!url.includes('/api/search/vehicles')) return real(input, init);

      const search = new URL(url, window.location.origin).searchParams.get('search') ?? '';

      if (behaviour.kind === 'fails') return Promise.resolve(new Response('{}', { status: 502 }));
      if (behaviour.kind === 'never') return new Promise<Response>(() => undefined);

      const words = search.toLowerCase().split(/\s+/);
      const rows =
        behaviour.kind === 'empty'
          ? []
          : ROWS.filter((row) => words.every((word) => row.label.toLowerCase().includes(word)));
      const payload: CarSuggestResponse = {
        search,
        data: rows,
        countLabel: `${String(rows.length)} ${rows.length === 1 ? 'match' : 'matches'}`,
      };

      return new Promise<Response>((resolve) => {
        setTimeout(
          () => resolve(new Response(JSON.stringify(payload), { status: 200 })),
          behaviour.kind === 'rows' ? (behaviour.delayMs ?? 120) : 0,
        );
      });
    };

    return () => {
      window.fetch = real;
    };
  }, [behaviour]);
}

function Harness({
  behaviour,
  ...props
}: { behaviour: Behaviour } & Parameters<typeof CarSearchBox>[0]) {
  useFakeSuggestEndpoint(behaviour);
  return <CarSearchBox {...props} />;
}

const meta = {
  title: 'Search/CarSearchBox',
  component: Harness,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  argTypes: {
    behaviour: { table: { disable: true } },
    params: { table: { disable: true } },
  },
  args: {
    behaviour: { kind: 'rows' },
    params: { district: 'ranipet' },
    basePath: '/cars',
    districtName: 'Ranipet',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, paddingBottom: 340 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EveryDistrict: Story = {
  args: { params: {}, districtName: undefined },
};

export const SearchAlreadyApplied: Story = {
  args: { params: { district: 'ranipet', q: 'SX(O)', brand: 'hyundai', model: 'creta' } },
};

export const Loading: Story = {
  args: { behaviour: { kind: 'never' } },
};

export const NothingFound: Story = {
  args: { behaviour: { kind: 'empty' } },
};

export const EndpointFailed: Story = {
  args: { behaviour: { kind: 'fails' } },
};
