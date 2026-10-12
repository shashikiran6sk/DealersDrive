import { documentGapLabel } from '@/lib/document-gaps';

import { DOCUMENT_REVIEW_TEXT } from './document-review.constants';

export function DocumentGaps({ gaps }: { gaps: readonly string[] }) {
  if (gaps.length === 0) return null;

  return (
    <div className="mb-2 border border-(--color-divider) bg-(--color-warn-bg) p-3 text-[13px]">
      <p className="font-medium text-(--color-warn)">{DOCUMENT_REVIEW_TEXT.gapsHeading}</p>
      <ul className="mt-1 list-disc pl-5 ink-secondary">
        {gaps.map((gap) => (
          <li key={gap}>{documentGapLabel(gap)}</li>
        ))}
      </ul>
    </div>
  );
}
