import type { AdminAccessResponse, ConfigResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import { AdminAccessPanel } from '@/features/admin/admin-access';
import { ConfigRow } from '@/features/admin/config-editor';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Configuration' };

export default async function AdminConfigPage() {
  const [config, access] = await Promise.all([
    apiGet<ConfigResponse>('/v1/admin/config', { revalidate: false }),
    apiGet<AdminAccessResponse>('/v1/admin/access', { revalidate: false }),
  ]);

  const inUse = config.data.filter((entry) => entry.readBy !== null);
  const dormant = config.data.filter((entry) => entry.readBy === null);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-6 p-5">
      <div>
        <h1 className="text-[26px]">Configuration</h1>
        <p className="mt-1 max-w-[70ch] text-[13px] ink-muted">
          These values are read at request time, so a change takes effect on the next request — no
          deploy. Every edit is written to the audit trail.
        </p>
      </div>

      <AdminAccessPanel entries={access.data} currentUserId={access.currentUserId} />

      <section className="flex flex-col gap-3">
        <h2 className="text-[17px]">Platform settings</h2>
        <div className="border border-(--color-divider) bg-white">
          {inUse.map((entry) => (
            <ConfigRow key={entry.key} entry={entry} />
          ))}
        </div>
      </section>

      {dormant.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-[17px]">Not in use yet</h2>
            <p className="mt-1 max-w-[70ch] text-[13px] ink-muted">
              Stored, and read by nothing — the features that consult these keys have not landed.
              They become editable in the section above on the day something reads them.
            </p>
          </div>
          <div className="border border-(--color-divider) bg-white">
            {dormant.map((entry) => (
              <ConfigRow key={entry.key} entry={entry} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
