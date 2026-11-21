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
    <>
      <div className="max-md:hidden">
        <Table columns={COLUMNS} caption={BILLING_TEXT.ledgerTitle}>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="whitespace-nowrap tnum">{entry.dateLabel}</td>
              <td>
                <span className="font-medium">{entry.label}</span>
                {entry.note ? (
                  <span className="block text-[12px] ink-muted">{entry.note}</span>
                ) : null}
              </td>
              <td className="text-right">
                <StatusTag tone={entry.tone}>{entry.changeLabel}</StatusTag>
              </td>
              <td className="text-right tnum">{entry.availableAfter}</td>
            </tr>
          ))}
        </Table>
      </div>
      <ul className="flex flex-col gap-2 md:hidden" aria-label={BILLING_TEXT.ledgerTitle}>
        {entries.map((entry) => (
          <li key={entry.id} className="card flex-row items-start gap-3 p-[12px] text-[13px]">
            <div className="min-w-0 flex-1">
              <span className="block font-medium">{entry.label}</span>
              {entry.note ? (
                <span className="block text-[12px] ink-muted">{entry.note}</span>
              ) : null}
              <span className="mt-1 block text-[12px] ink-subtle tnum">
                {entry.dateLabel} · {BILLING_TEXT.availableAfter(entry.availableAfter)}
              </span>
            </div>
            <StatusTag tone={entry.tone}>{entry.changeLabel}</StatusTag>
          </li>
        ))}
      </ul>
    </>
  );
}
