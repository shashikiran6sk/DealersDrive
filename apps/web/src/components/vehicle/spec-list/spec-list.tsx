import type { PublicVehicleDetail } from '@dealers-drive/contracts';

export function SpecList({ specs }: { specs: PublicVehicleDetail['specs'] }) {
  return (
    <dl className="overflow-hidden rounded-[14px] border border-(--color-divider) bg-white">
      {specs.map((spec) => (
        <div
          key={spec.label}
          className="flex items-baseline justify-between gap-4 border-b border-(--color-rule) px-[16px] py-[12px] last:border-b-0"
        >
          <dt className="text-[14px] ink-muted">{spec.label}</dt>
          <dd className="m-0 text-right text-[14px] font-semibold tnum">{spec.value}</dd>
        </div>
      ))}
    </dl>
  );
}
