import { RecordVisitForm } from './record-visit-form';
import { YardVisitRow } from './yard-visit-row';
import { YARD_VISITS_TEXT } from './yard-visits.constants';
import type { YardVisitsPanelProps } from './yard-visits.types';

export function YardVisitsPanel({ dealerId, visits }: YardVisitsPanelProps) {
  if (visits === null) return null;

  return (
    <section className="card gap-3 p-4" aria-labelledby="yard-visits-heading">
      <div>
        <h2 id="yard-visits-heading" className="text-[19px]">
          {YARD_VISITS_TEXT.heading}
        </h2>
        <p className="mt-1 text-[12px] ink-secondary">{YARD_VISITS_TEXT.privacy}</p>
        <p className="mt-1 text-[12px] ink-secondary">{YARD_VISITS_TEXT.noYardIsFine}</p>
      </div>

      {visits.length === 0 ? (
        <p className="text-[13px] ink-muted">{YARD_VISITS_TEXT.empty}</p>
      ) : (
        <ul className="flex flex-col">
          {visits.map((visit) => (
            <YardVisitRow key={visit.id} dealerId={dealerId} visit={visit} />
          ))}
        </ul>
      )}

      <RecordVisitForm dealerId={dealerId} />
    </section>
  );
}
