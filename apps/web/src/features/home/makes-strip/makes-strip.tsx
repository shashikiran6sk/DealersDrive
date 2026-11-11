import { MakesList } from './makes-list';
import { MAKES_STRIP_MIN, MAKES_STRIP_TEXT } from './makes-strip.constants';
import type { MakesStripProps } from './makes-strip.types';

export function MakesStrip({ makes }: MakesStripProps) {
  if (makes.length < MAKES_STRIP_MIN) return null;

  return (
    <section
      aria-label={MAKES_STRIP_TEXT.label}
      data-home-section="makes"
      className="dd-makes relative border-b border-(--color-divider)"
    >
      <div className="dd-makes-scroll">
        <div className="dd-makes-track flex w-max">
          <MakesList makes={makes} />
          <MakesList makes={makes} copy />
        </div>
      </div>
    </section>
  );
}
