/**
 * DESIGN-SPEC §2.20 — the skeleton mirrors the real layout's dimensions, so
 * nothing shifts when the content lands.
 */
export default function VehicleDetailLoading() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 pb-[60px] pt-[22px]">
      <div className="skeleton mb-[14px] w-[120px]" />

      <div className="grid gap-[30px] lg:[grid-template-columns:1.35fr_1fr]">
        <div className="min-w-0">
          <div className="aspect-[4/3] w-full border border-(--color-divider) bg-(--color-surface)" />
          <div className="mt-[14px] flex gap-2 px-[34px]">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="aspect-[4/3] w-[108px] flex-none border border-(--color-divider) bg-(--color-surface)"
              />
            ))}
          </div>

          <div className="mt-[34px] border border-(--color-divider) bg-white">
            {Array.from({ length: 8 }, (_, index) => (
              <div
                key={index}
                className="flex justify-between gap-4 border-b border-[color-mix(in_srgb,var(--color-ink)_8%,transparent)] px-[14px] py-[11px] last:border-b-0"
              >
                <div className="skeleton w-[90px]" />
                <div className="skeleton w-[64px]" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="skeleton h-[22px] w-[70px]" />
          <div className="skeleton h-[28px] w-[70%]" />
          <div className="h-[118px] border border-(--color-divider) bg-white" />
          <div className="h-11 bg-(--color-neutral-300)" />
          <div className="flex gap-2">
            <div className="h-10 flex-1 bg-(--color-neutral-300)" />
            <div className="h-10 flex-1 bg-(--color-neutral-300)" />
          </div>
          <div className="h-[104px] border border-(--color-divider) bg-white" />
        </div>
      </div>
    </div>
  );
}
