import type { CreditLedgerEntry } from '@dealers-drive/contracts';

import { StatusTag } from '@/components/ui/primitives';
import { Table } from '@/components/ui/table';

import { BILLING_TEXT } from './billing.constants';

const COLUMNS = [
  { key: 'date', label: BILLING_TEXT.columns.date },
  { key: 'what', label: BILLING_TEXT.columns.what },
  { key: 'change', label: BILLING_TEXT.columns.change, align: 'right' as const },
  { key: 'available', label: BILLING_TEXT.columns.available, align: 'right' as const },
];

export function CreditLedger({ entries }: { entries: readonly CreditLedgerEntry[] }) {
  if (entries.length === 0)
    return <p className="text-[13px] ink-muted">{BILLING_TEXT.ledgerEmpty}</p>;
  return (
    <Table columns={COLUMNS} caption={BILLING_TEXT.ledgerTitle}>
      {entries.map((entry) => (
        <tr key={entry.id}>
          <td className="whitespace-nowrap tnum">{entry.dateLabel}</td>
          <td>
            <span className="font-medium">{entry.label}</span>
            {entry.note ? <span className="block text-[12px] ink-muted">{entry.note}</span> : null}
          </td>
          <td className="text-right">
            <StatusTag tone={entry.tone}>{entry.changeLabel}</StatusTag>
          </td>
          <td className="text-right tnum">{entry.availableAfter}</td>
        </tr>
      ))}
    </Table>
  );
}
