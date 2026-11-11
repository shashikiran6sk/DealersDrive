import { cn } from '@/lib/cn';

import { STOCK_STREAM_TEXT } from './stock-stream.constants';
import type { StockStreamProps } from './stock-stream.types';
import { StreamColumn } from './stream-column';
import { splitColumns } from './utils';

export function StockStream({ cars, className }: StockStreamProps) {
  const [left, right] = splitColumns(cars);

  return (
    <div
      role="region"
      aria-label={STOCK_STREAM_TEXT.label}
      data-stock-stream
      className={cn('relative', className)}
    >
      <div className="dd-stream grid h-[360px] grid-cols-2 gap-3.5 overflow-hidden rounded-[28px] bg-(--color-neutral-100) px-3.5 [mask-image:linear-gradient(transparent,#000_12%,#000_88%,transparent)] md:h-[600px]">
        <StreamColumn cars={left} direction="up" />
        <StreamColumn cars={right} direction="down" />
      </div>
    </div>
  );
}
