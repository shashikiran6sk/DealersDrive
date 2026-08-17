import type { ConfigResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import { ConfigRow } from '@/features/admin/config-editor';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Configuration' };

export default async function AdminConfigPage() {
  const config = await apiGet<ConfigResponse>('/v1/admin/config', { revalidate: false });

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4 p-5">
      <div>
        <h1 className="text-[26px]">Configuration</h1>
        <p className="mt-1 max-w-[70ch] text-[13px] ink-muted">
          These values are read at request time, so a change takes effect on the next request — no
          deploy. Every edit is written to the audit trail.
        </p>
      </div>

      <div className="border border-(--color-divider) bg-white">
        {config.data.map((entry) => (
          <ConfigRow key={entry.key} entry={entry} />
        ))}
      </div>
    </div>
  );
}
