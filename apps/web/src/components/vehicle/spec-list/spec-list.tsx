import type { PublicVehicleDetail } from '@dealers-drive/contracts';

export function SpecList({ specs }: { specs: PublicVehicleDetail['specs'] }) {
  return (
    <dl className="border border-(--color-divider) bg-white">
      {specs.map((spec) => (
        <div
          key={spec.label}
          className="flex items-baseline justify-between gap-4 border-b border-(--color-divider) px-[14px] py-[11px] last:border-b-0"
        >
          <dt className="text-[13px] ink-secondary">{spec.label}</dt>
          <dd className="m-0 text-right text-[13px] font-medium tnum">{spec.value}</dd>
        </div>
      ))}
    </dl>
  );
}
