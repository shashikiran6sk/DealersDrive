import type { DashboardResponse } from '@dealers-drive/contracts';

export function ViewsChart({ chart }: { chart: DashboardResponse['viewsChart'] }) {
  return (
    <section className="card gap-3 p-[14px]">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[19px]">{chart.title}</h2>
        <span className="ml-auto text-[12px] ink-muted tnum">{chart.totalLabel}</span>
      </div>

      <div className="flex h-[132px] items-end gap-[9px] max-[375px]:h-[110px]">
        {chart.series.map((point) => (
          <div key={point.date} className="flex h-full flex-1 flex-col justify-end">
            <div
              className="bg-(--color-accent)"
              style={{ height: `${String(point.heightPct)}%` }}
              role="img"
              aria-label={`${point.day}: ${String(point.views)} views`}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-[9px]">
        {chart.series.map((point) => (
          <div key={point.date} className="flex-1 text-center text-[10px] ink-subtle">
            {point.day}
          </div>
        ))}
      </div>
    </section>
  );
}
