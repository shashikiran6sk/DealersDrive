import type { AdminAccessResponse, ConfigResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import { AdminAccessPanel } from '@/features/admin/admin-access';
import { ConfigRow } from '@/features/admin/config-editor';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Configuration' };

/**
 * D14 — the settings screen (**F072**), with admin access on it (**R42**).
 *
 * Two sections, and the split is by what a change does rather than by what it
 * looks like:
 *
 *   **In use** — a key some running code reads. Changing one of these changes
 *   the platform's behaviour on the next request, with no deploy.
 *
 *   **Not in use yet** — a key that exists in `CONFIG_DEFAULTS` and is read by
 *   nothing, because the feature that will read it has not been reconstructed.
 *   These are shown rather than hidden, because "what will the listing duration
 *   be" is a fair question, and they are read-only, because an editable control
 *   that changes no behaviour is a lie told politely.
 *
 * The API decides which is which — `readBy` is a fact about the server, not a
 * list this page maintains.
 */
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
