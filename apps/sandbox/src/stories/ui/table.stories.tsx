import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { StatusTag } from '@/components/ui/primitives';
import { NumericCell, Table } from '@/components/ui/table';

/**
 * DESIGN-SPEC §2.13 — the table, **new at F045**.
 *
 * `.table` has existed in `globals.css` since the first stylesheet and had no
 * React wrapper, so the same markup was written by hand in five pages (finding
 * D-B). This is the first of those five in the reconstruction, which makes it
 * the moment the duplication costs nothing to prevent.
 *
 * The story that earns its place is **Overflow**. A table wider than its column
 * has to scroll inside its own bordered box; a page that scrolls sideways
 * instead is the admin console's most common layout bug below 768px, and it is
 * invisible on the desktop the console is designed on. The container is part of
 * the component precisely so a caller cannot forget it — this scenario is how
 * you check that by eye rather than by trusting the prop.
 */
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

/** The admin dealer list, which is what the component was extracted from. */
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

/**
 * One row. The last row drops its bottom border, so a single-row table has no
 * dangling rule under it — worth seeing, because it is the only row that
 * exercises `tbody tr:last-child`.
 */
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

/**
 * Wider than its container. The bordered box scrolls; the page must not.
 * Resize the preview and check that the page itself never gains a horizontal
 * scrollbar — that is the whole reason the container lives in the component.
 */
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

/**
 * No rows. The component renders an empty `<tbody>` rather than a message —
 * "nothing here" is the page's decision, not the table's, because the wording
 * depends on whether a filter is applied. `EmptyState` is what the admin pages
 * render instead of a table when the list comes back empty.
 */
export const NoRows: Story = {
  args: { columns: COLUMNS.slice(0, 4), children: null },
};
