import { StatusTag } from '@/components/ui/primitives';
import { formatIstDate, formatIstDateTime } from '@/lib/dates';

import { YardVisitPhotoUpload } from './yard-visit-photo-upload';
import { OUTCOME_TONE, YARD_VISITS_TEXT } from './yard-visits.constants';
import type { YardVisitRowProps } from './yard-visits.types';

export function YardVisitRow({ dealerId, visit }: YardVisitRowProps) {
  const dateLabel = formatIstDate(visit.visitedOn);
  const recordedAt = formatIstDateTime(visit.recordedAt);

  return (
    <li className="flex flex-col gap-2 border-b border-(--color-divider) py-[10px] text-[13px] last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium tnum">{dateLabel}</span>
        <StatusTag tone={OUTCOME_TONE[visit.outcome]}>{visit.outcomeLabel}</StatusTag>
      </div>

      {visit.outcome === 'NO_PHYSICAL_YARD' ? (
        <p className="text-[12px] ink-muted">{YARD_VISITS_TEXT.noYardRowNote}</p>
      ) : null}

      {visit.notes ? <p className="whitespace-pre-line ink-secondary">{visit.notes}</p> : null}

      {visit.photos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {visit.photos.map((photo, index) => (
            <a
              key={photo.mediaId}
              href={photo.url}
              target="_blank"
              rel="noreferrer noopener"
              className="block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={YARD_VISITS_TEXT.photoAlt(index, dateLabel)}
                className="h-[72px] w-[96px] border border-(--color-divider) object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}

      <YardVisitPhotoUpload
        dealerId={dealerId}
        visitId={visit.id}
        dateLabel={dateLabel}
        photoCount={visit.photos.length}
      />

      <p className="text-[11px] ink-faint">
        {visit.recordedBy
          ? YARD_VISITS_TEXT.recordedBy(visit.recordedBy, recordedAt)
          : YARD_VISITS_TEXT.recordedAt(recordedAt)}
      </p>
    </li>
  );
}
