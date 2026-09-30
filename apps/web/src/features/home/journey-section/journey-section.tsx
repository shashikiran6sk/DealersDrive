import { Blueprint } from '@/components/ui/primitives';

import { JOURNEY_STEPS, JOURNEY_TEXT } from './journey-section.constants';

export function JourneySection() {
  return (
    <section
      aria-labelledby="home-journey-heading"
      data-home-section="journey"
      className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 md:py-16 lg:px-10"
    >
      <div className="mb-8 max-w-[62ch]">
        <div className="eyebrow mb-3">{JOURNEY_TEXT.eyebrow}</div>
        <h2 id="home-journey-heading" className="text-[30px] sm:text-[36px]">
          {JOURNEY_TEXT.title}
        </h2>
        <p className="mt-3 text-[15px] ink-secondary">{JOURNEY_TEXT.body}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {JOURNEY_STEPS.map((step) => (
          <Blueprint key={step.number} className="bg-white p-6" as="article">
            <div className="font-mono text-[11px] ink-muted">{step.number}</div>
            <h3 className="mt-8 text-[20px]">{step.title}</h3>
            <p className="mt-2 text-[13px] leading-[1.65] ink-secondary">{step.body}</p>
          </Blueprint>
        ))}
      </div>
    </section>
  );
}
