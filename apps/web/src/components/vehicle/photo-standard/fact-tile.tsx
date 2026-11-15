import type { ShotFact } from './photo-standard.types';

export function FactTile({ label, fact }: { label: string; fact: ShotFact }) {
  return (
    <div className="flex flex-col rounded-[10px] border border-(--color-divider) bg-white p-[10px]">
      <span className="text-[10px] font-semibold tracking-[0.08em] uppercase ink-muted">
        {label}
      </span>
      <span className="text-[15px] font-semibold tnum">{fact.value}</span>
      <span className="text-[11px] ink-muted">{fact.note}</span>
    </div>
  );
}
