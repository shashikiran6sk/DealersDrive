import { SupportIcon } from './support-icon';
import type { SupportCardProps } from './support-page.types';

export function SupportCard({ icon, title, body, headingId, children }: SupportCardProps) {
  return (
    <article className="card min-w-0 items-start gap-[12px] p-6" aria-labelledby={headingId}>
      <SupportIcon name={icon} />
      <h2 id={headingId} className="text-[18px]">
        {title}
      </h2>
      <p className="flex-1 text-[14px] leading-[1.6] ink-muted">{body}</p>
      <div className="flex w-full flex-col gap-[8px]">{children}</div>
    </article>
  );
}
