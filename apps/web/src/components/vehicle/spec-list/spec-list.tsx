import type { PublicVehicleDetail } from '@dealers-drive/contracts';

export function SpecList({ specs }: { specs: PublicVehicleDetail['specs'] }) {
  return (
    <dl className="overflow-hidden rounded-[14px] border border-(--color-divider) bg-white">
      {specs.map((spec) => (
        <div
          key={spec.label}
          className="flex items-baseline justify-between gap-4 border-b border-(--color-rule) px-[16px] py-[12px] last:border-b-0"
        >
          <dt className="text-[14px] ink-muted max-md:min-w-0 max-md:flex-1">{spec.label}</dt>
          <dd className="m-0 text-right text-[14px] font-semibold tnum max-md:min-w-0 max-md:flex-1 max-md:[overflow-wrap:anywhere]">
            {spec.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
