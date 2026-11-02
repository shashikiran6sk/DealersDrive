import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { RelatedSearches } from '@/components/search/related-searches';

const meta = {
  title: 'Search/RelatedSearches',
  component: RelatedSearches,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  args: {
    heading: 'More used cars around Arcot',
    groups: [
      {
        title: 'Popular searches in Arcot',
        links: [
          { href: '/used-cars/arcot/maruti-suzuki', label: 'Used Maruti Suzuki Cars in Arcot' },
          {
            href: '/used-cars/arcot/maruti-suzuki-swift',
            label: 'Used Maruti Suzuki Swift Cars in Arcot',
          },
          { href: '/used-cars/arcot/hyundai', label: 'Used Hyundai Cars in Arcot' },
          { href: '/used-cars/arcot/petrol', label: 'Used Petrol Cars in Arcot' },
          { href: '/used-cars/arcot/diesel', label: 'Used Diesel Cars in Arcot' },
          { href: '/used-cars/arcot/under-5-lakh', label: 'Used Cars Under ₹5 lakh in Arcot' },
        ],
      },
      {
        title: 'Towns in Ranipet district',
        links: [
          { href: '/cars?district=ranipet', label: 'All used cars in Ranipet district' },
          { href: '/used-cars/walajapet', label: 'Used Cars in Walajapet' },
        ],
      },
    ],
  },
} satisfies Meta<typeof RelatedSearches>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ATown: Story = {};

export const ADistrict: Story = {
  args: {
    heading: 'More used cars around Ranipet',
    groups: [
      {
        title: 'Popular searches in Ranipet',
        links: [
          { href: '/used-cars/ranipet/maruti-suzuki', label: 'Used Maruti Suzuki Cars in Ranipet' },
          { href: '/used-cars/ranipet/suv', label: 'Used SUV Cars in Ranipet' },
          { href: '/used-cars/ranipet/automatic', label: 'Used Automatic Cars in Ranipet' },
        ],
      },
      {
        title: 'Towns in Ranipet district',
        links: [
          { href: '/used-cars/arcot', label: 'Used Cars in Arcot' },
          { href: '/used-cars/walajapet', label: 'Used Cars in Walajapet' },
        ],
      },
    ],
  },
};

export const OneGroup: Story = {
  args: {
    groups: [
      {
        title: 'Popular searches in Arcot',
        links: [{ href: '/used-cars/arcot/diesel', label: 'Used Diesel Cars in Arcot' }],
      },
      { title: 'Towns in Ranipet district', links: [] },
    ],
  },
};

export const Empty: Story = {
  args: { groups: [{ title: 'Popular searches in Arcot', links: [] }] },
};
