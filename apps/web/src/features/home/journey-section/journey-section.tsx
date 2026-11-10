import { Blueprint } from '@/components/ui/primitives';

import { JOURNEY_STEPS, JOURNEY_TEXT } from './journey-section.constants';

export function JourneySection() {
  return (
    <section
      aria-labelledby="home-journey-heading"
      data-home-section="journey"
      className="mx-auto max-w-[1440px] px-4 py-12 max-md:py-8 sm:px-6 md:py-16 lg:px-10"
    >
      <div className="mb-8 max-w-[62ch] max-md:mb-5">
        <div className="eyebrow mb-3">{JOURNEY_TEXT.eyebrow}</div>
        <h2 id="home-journey-heading" className="text-[30px] sm:text-[36px]">
          {JOURNEY_TEXT.title}
        </h2>
        <p className="mt-3 text-[15px] ink-secondary">{JOURNEY_TEXT.body}</p>
      </div>

      <div className="dd-journey grid grid-cols-[2px_minmax(0,1fr)] gap-4 md:grid-cols-1">
        <div
          aria-hidden="true"
          className="dd-journey-line relative my-2 bg-(--color-divider) md:mx-2 md:my-0 md:h-0.5"
        >
          <span className="absolute inset-0 origin-top bg-(--color-ink) md:origin-left" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {JOURNEY_STEPS.map((step) => (
            <Blueprint
              key={step.number}
              className="dd-journey-step bg-white p-6 max-md:p-4"
              as="article"
            >
              <div className="dd-journey-num grid size-[30px] place-items-center rounded-full bg-(--color-ink) font-mono text-[11px] text-white">
                {step.number}
              </div>
              <h3 className="mt-6 text-[20px] max-md:mt-3 max-md:text-[18px]">{step.title}</h3>
              <p className="mt-2 text-[13px] leading-[1.65] ink-secondary">{step.body}</p>
            </Blueprint>
          ))}
        </div>
      </div>
    </section>
  );
}
