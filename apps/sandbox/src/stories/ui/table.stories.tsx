import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { StatusTag } from '@/components/ui/primitives';
import { NumericCell, Table } from '@/components/ui/table';

const meta = {
  title: 'Primitives/Table',
  component: Table,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const COLUMNS = [
  { key: 'dealer', label: 'Dealer' },
  { key: 'city', label: 'City' },
  { key: 'status', label: 'Status' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'joined', label: 'Joined' },
  { key: 'actions', label: 'Actions', align: 'right' as const },
];

const ROWS = [
  { name: 'Sri Lakshmi Motors', city: 'Vellore', tone: 'ok', label: 'Verified', n: 12 },
  { name: 'Chennai Car Bazaar', city: 'Chennai', tone: 'warn', label: 'Pending', n: 3 },
  { name: 'Kovai Auto Mart', city: 'Coimbatore', tone: 'err', label: 'Suspended', n: 0 },
] as const;

export const Default: Story = {
  args: {
    columns: COLUMNS,
    caption: 'Every dealership on the platform',
    children: ROWS.map((row) => (
      <tr key={row.name}>
        <td>
          <div className="text-[13px] font-medium">{row.name}</div>
          <div className="text-[11px] ink-subtle">Documents verified</div>
        </td>
        <td>{row.city}</td>
        <td>
          <StatusTag tone={row.tone}>{row.label}</StatusTag>
        </td>
        <NumericCell>{row.n}</NumericCell>
        <NumericCell className="whitespace-nowrap">14 Aug 2026</NumericCell>
        <td className="whitespace-nowrap text-right">
          <a href="#" className="btn btn-ghost text-[12px]">
            Manage
          </a>
        </td>
      </tr>
    )),
  },
};

export const SingleRow: Story = {
  args: {
    columns: COLUMNS.slice(0, 4),
    children: (
      <tr>
        <td>Sri Lakshmi Motors</td>
        <td>Vellore</td>
        <td>
          <StatusTag tone="ok">Verified</StatusTag>
        </td>
        <NumericCell>12</NumericCell>
      </tr>
    ),
  },
};

export const Overflow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 380, outline: '1px dashed rgb(0 0 0 / 0.25)', padding: 8 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    columns: [
      ...COLUMNS.slice(0, 5),
      { key: 'credits', label: 'Credit balance' },
      { key: 'enquiries', label: 'Enquiries this month' },
      COLUMNS[5]!,
    ],
    children: (
      <tr>
        <td className="whitespace-nowrap">Sri Lakshmi Motors</td>
        <td>Vellore</td>
        <td>
          <StatusTag tone="ok">Verified</StatusTag>
        </td>
        <NumericCell>12</NumericCell>
        <NumericCell className="whitespace-nowrap">14 Aug 2026</NumericCell>
        <NumericCell>39</NumericCell>
        <NumericCell>147</NumericCell>
        <td className="whitespace-nowrap text-right">
          <a href="#" className="btn btn-ghost text-[12px]">
            Manage
          </a>
        </td>
      </tr>
    ),
  },
};

export const NoRows: Story = {
  args: { columns: COLUMNS.slice(0, 4), children: null },
};
