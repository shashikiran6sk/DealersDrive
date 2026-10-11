import type {
  ConfigResponse,
  ServiceLocationsResponse,
  ServiceLocationHistory,
} from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ServiceLocationsEditor } from '@/features/admin/service-locations-editor';

import { Banner } from '@/components/ui/primitives';
import { ConfigRow } from '@/features/admin/config-editor';
import { CONFIG_PAGE_TEXT } from '@/features/admin/config-editor/config-editor.constants';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Configuration' };

export default async function AdminConfigPage() {
  const [config, locations, history] = await Promise.all([
    apiGet<ConfigResponse>('/v1/admin/config', { revalidate: false }),
    apiGet<ServiceLocationsResponse>('/v1/admin/service-locations', { revalidate: false }),
    apiGet<ServiceLocationHistory>('/v1/admin/service-locations/history', { revalidate: false }),
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

      <Banner
        tone="ok"
        title={CONFIG_PAGE_TEXT.membersMovedTitle}
        action={<Link href="/admin/members">{CONFIG_PAGE_TEXT.membersMovedLink}</Link>}
      >
        {CONFIG_PAGE_TEXT.membersMovedBody}
      </Banner>

      <ServiceLocationsEditor initial={locations} history={history} />

      <section className="flex flex-col gap-3">
        <h2 className="text-[17px]">Platform settings</h2>
        <div className="overflow-hidden rounded-[14px] border border-(--color-divider) bg-white">
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
          <div className="overflow-hidden rounded-[14px] border border-(--color-divider) bg-white">
            {dormant.map((entry) => (
              <ConfigRow key={entry.key} entry={entry} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
