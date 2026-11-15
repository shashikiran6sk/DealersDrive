import { ShotFacts } from './shot-facts';
import { ShotHeading } from './shot-heading';
import { ShotIllustration } from './shot-illustration';
import { ShotInstructions } from './shot-instructions';
import type { ShotGuide } from './photo-standard.types';

export function ShotGuideCard({ shot }: { shot: ShotGuide }) {
  return (
    <article
      id={`shot-${String(shot.number)}`}
      className="card flex scroll-mt-24 flex-col gap-3 p-[16px]"
    >
      <ShotHeading shot={shot} />
      <ShotIllustration shot={shot} />
      <ShotFacts shot={shot} />
      <ShotInstructions shot={shot} />
    </article>
  );
}
