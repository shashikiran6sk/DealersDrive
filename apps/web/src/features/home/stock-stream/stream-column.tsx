import type { StreamColumnProps } from './stock-stream.types';
import { StreamCard } from './stream-card';

export function StreamColumn({ cars, direction }: StreamColumnProps) {
  return (
    <div className="dd-stream-col flex flex-col" data-direction={direction}>
      <div className="flex flex-col gap-3.5 pb-3.5">
        {cars.map((car) => (
          <StreamCard key={car.slug} car={car} />
        ))}
      </div>
      <div className="flex flex-col gap-3.5 pb-3.5" aria-hidden="true" data-loop-copy>
        {cars.map((car) => (
          <StreamCard key={car.slug} car={car} />
        ))}
      </div>
    </div>
  );
}
