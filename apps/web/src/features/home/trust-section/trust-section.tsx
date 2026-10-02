import { TRUST_POINTS, TRUST_TEXT } from './trust-section.constants';

export function TrustSection() {
  return (
    <section
      aria-labelledby="home-trust-heading"
      data-home-section="trust"
      className="bg-(--color-accent-900) text-white"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 md:py-16 lg:px-10">
        <div className="mb-8 max-w-[58ch]">
          <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-(--color-accent-400)">
            {TRUST_TEXT.eyebrow}
          </div>
          <h2 id="home-trust-heading" className="text-[30px] text-white sm:text-[36px]">
            {TRUST_TEXT.title}
          </h2>
        </div>

        <div className="grid gap-x-7 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
          {TRUST_POINTS.map((point) => (
            <div key={point.number} className="border-t border-white/25 pt-4">
              <div className="font-mono text-[11px] text-white/60">{point.number}</div>
              <h3 className="mt-5 text-[17px] text-white">{point.title}</h3>
              <p className="mt-2 text-[13px] leading-[1.65] text-white/75">{point.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
