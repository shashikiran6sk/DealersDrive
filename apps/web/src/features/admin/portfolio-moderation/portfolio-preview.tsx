import { ImageSlot } from '@/components/ui/primitives';

import type { PortfolioPreviewProps } from './portfolio-moderation.types';

export function PortfolioPreview({ url, alt, label, fallback }: PortfolioPreviewProps) {
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-[6px]">
      <figcaption className="text-[11px] font-semibold ink-muted">{label}</figcaption>
      <div className="aspect-[4/3] overflow-hidden border border-(--color-divider) bg-(--color-surface)">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <ImageSlot label={fallback} className="h-full w-full" />
        )}
      </div>
    </figure>
  );
}
