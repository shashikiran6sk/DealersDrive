import type { DealerSuggestResponse } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect } from 'react';
import { fn } from 'storybook/test';

import { DealerSearchBox } from '@/components/dealers/dealer-search-box';

const YARDS: DealerSuggestResponse['data'] = [
  {
    slug: 'vellore-cars',
    brandName: 'Vellore Cars',
    initials: 'VC',
    metaLabel: '42 cars in yard · Katpadi, Vellore',
    matchedOn: 'brandName',
    carCount: 42,
    isVerified: true,
  },
  {
    slug: 'vellore-star-auto-yards',
    brandName: 'Vellore Star Auto Yards',
    initials: 'VS',
    metaLabel: '18 cars in yard · Gandhi Nagar, Vellore',
    matchedOn: 'brandName',
    carCount: 18,
    isVerified: true,
  },
  {
    slug: 'royal-vellore-motors',
    brandName: 'Royal Vellore Motors',
    initials: 'RV',
    metaLabel: '29 cars in yard · Arcot Road, Vellore',
    matchedOn: 'brandName',
    carCount: 29,
    isVerified: true,
  },
  {
    slug: 'honest-wheels-vellore',
    brandName: 'Honest Wheels Vellore',
    initials: 'HW',
    metaLabel: '31 cars in yard · Bagayam, Vellore',
    matchedOn: 'brandName',
    carCount: 31,
    isVerified: true,
  },
];

const BY_PLACE: DealerSuggestResponse['data'] = [
  {
    slug: 'anand-motors',
    brandName: 'Anand Motors',
    initials: 'AM',
    metaLabel: '12 cars in yard · Katpadi, Vellore',
    matchedOn: 'city',
    carCount: 12,
    isVerified: true,
  },
  {
    slug: 'sri-lakshmi-motors',
    brandName: 'Sri Lakshmi Motors',
    initials: 'SL',
    metaLabel: '7 cars in yard · Katpadi, Vellore',
    matchedOn: 'city',
    carCount: 7,
    isVerified: true,
  },
];

type Behaviour =
  | { kind: 'rows'; rows: DealerSuggestResponse['data']; delayMs?: number }
  | { kind: 'empty' }
  | { kind: 'never' }
  | { kind: 'fails' };

function useFakeSuggestEndpoint(behaviour: Behaviour): void {
  useEffect(() => {
    const real = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (!url.includes('/api/search/dealers')) return real(input, init);

      const search = new URL(url, window.location.origin).searchParams.get('search') ?? '';

      if (behaviour.kind === 'fails') {
        return Promise.resolve(new Response('{}', { status: 502 }));
      }
      if (behaviour.kind === 'never') {
        return new Promise<Response>(() => undefined);
      }

      const rows =
        behaviour.kind === 'empty'
          ? []
          : behaviour.rows.filter((row) =>
              `${row.brandName} ${row.metaLabel}`.toLowerCase().includes(search.toLowerCase()),
            );

      const payload: DealerSuggestResponse = {
        search,
        data: rows,
        countLabel: `${String(rows.length)} matching ${rows.length === 1 ? 'yard' : 'yards'}`,
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
}: { behaviour: Behaviour } & Parameters<typeof DealerSearchBox>[0]) {
  useFakeSuggestEndpoint(behaviour);
  return <DealerSearchBox {...props} />;
}

const meta = {
  title: 'Search/DealerSearchBox',
  component: Harness,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  argTypes: {
    behaviour: { table: { disable: true } },
  },
  args: {
    behaviour: { kind: 'rows', rows: YARDS },
    districtName: 'Vellore',
    district: 'vellore',
    onSearch: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ width: 560, paddingBottom: 340 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoDistrict: Story = {
  args: { district: undefined, districtName: undefined },
};

export const SearchAlreadyApplied: Story = {
  args: { q: 'Vellore Cars' },
};

export const MatchedOnAPlace: Story = {
  args: { behaviour: { kind: 'rows', rows: BY_PLACE } },
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

export const SlowEndpoint: Story = {
  args: { behaviour: { kind: 'rows', rows: YARDS, delayMs: 1200 } },
};
