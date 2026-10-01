import type { SupportMessage } from '@dealers-drive/contracts';

import { cn } from '@/lib/cn';

export function SupportMessageBubble({
  author,
  authorLabel,
  body,
  createdAt,
  createdLabel,
  tag,
  side,
}: Pick<SupportMessage, 'author' | 'authorLabel' | 'body' | 'createdAt' | 'createdLabel'> & {
  tag?: string;
  side?: 'start' | 'end';
}) {
  const mine = author === 'CUSTOMER';
  const end = side ? side === 'end' : mine;
  return (
    <li className={cn('flex', end ? 'justify-end' : 'justify-start')}>
      <article
        className={cn(
          'flex max-w-[min(100%,560px)] flex-col gap-[6px] rounded-[14px] border px-[14px] py-[12px]',
          mine
            ? 'border-(--color-divider) bg-(--color-neutral-100)'
            : 'border-(--color-divider) border-l-[3px] border-l-(--color-accent) bg-white',
        )}
      >
        <header className="flex flex-wrap items-baseline gap-x-[8px] text-[12px]">
          <span className="font-extrabold text-(--color-ink)">{authorLabel}</span>
          {tag ? <span className="ink-subtle">· {tag}</span> : null}
          <time dateTime={createdAt} className="ink-subtle tnum">
            {createdLabel}
          </time>
        </header>
        <p className="m-0 text-[14px] leading-[1.55] whitespace-pre-line [overflow-wrap:anywhere]">
          {body}
        </p>
      </article>
    </li>
  );
}
