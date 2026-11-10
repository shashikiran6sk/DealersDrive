import { StreamPauseButton } from '../stock-stream';
import { MakesList } from './makes-list';
import { MAKES_STRIP_MIN, MAKES_STRIP_TEXT } from './makes-strip.constants';
import type { MakesStripProps } from './makes-strip.types';

export function MakesStrip({ makes }: MakesStripProps) {
  if (makes.length < MAKES_STRIP_MIN) return null;

  return (
    <nav
      aria-label={MAKES_STRIP_TEXT.label}
      data-home-section="makes"
      data-pausable
      className="dd-makes relative border-b border-(--color-divider)"
    >
      <div className="dd-makes-scroll">
        <div className="dd-makes-track flex w-max">
          <MakesList makes={makes} />
          <MakesList makes={makes} copy />
        </div>
      </div>
      <StreamPauseButton
        label={MAKES_STRIP_TEXT.pause}
        className="absolute top-1/2 right-3 size-9 -translate-y-1/2"
      />
    </nav>
  );
}
