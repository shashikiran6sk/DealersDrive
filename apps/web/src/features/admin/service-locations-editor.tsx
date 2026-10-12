'use client';

import type {
  ServiceDistrictDto,
  ServiceLocationHistory,
  ServiceLocationsResponse,
  ServiceStateDto,
} from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import {
  updateServiceLocationAction,
  addServiceDistrictAction,
  type ServiceLocationResult,
} from './service-location-actions';

const AuditSettings = z.object({
  active: z.boolean().optional(),
  onboardingEnabled: z.boolean().optional(),
  photographyAvailable: z.boolean().optional(),
  name: z.string().optional(),
  sourceUrl: z.string().optional(),
});
function auditSummary(value: unknown) {
  const parsed = AuditSettings.safeParse(value);
  if (!parsed.success) return 'No previous settings';
  const data = parsed.data;
  return [
    data.name ? `District: ${data.name}` : null,
    data.active === undefined ? null : `Active: ${data.active ? 'Yes' : 'No'}`,
    data.onboardingEnabled === undefined
      ? null
      : `New onboarding: ${data.onboardingEnabled ? 'Enabled' : 'Disabled'}`,
    data.photographyAvailable === undefined
      ? null
      : `Photography: ${data.photographyAvailable ? 'Available' : 'Unavailable'}`,
    data.sourceUrl ? `Government source: ${data.sourceUrl}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function LocationSettings({
  item,
  kind,
  onResult,
}: {
  item: ServiceDistrictDto | ServiceStateDto;
  kind: 'state' | 'district';
  onResult: (result: ServiceLocationResult) => void;
}) {
  const [pending, setPending] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true);
    try {
      onResult(
        await updateServiceLocationAction(kind, item.id, {
          expectedVersion: item.version,
          active: values.has('active'),
          onboardingEnabled: values.has('onboardingEnabled'),
          ...(kind === 'district'
            ? { photographyAvailable: values.has('photographyAvailable') }
            : {}),
        }),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      onSubmit={(event) => {
        void save(event);
      }}
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-(--color-divider) p-3"
    >
      <span className="w-full text-[14px] font-semibold sm:w-auto sm:min-w-[140px]">
        {item.name}
      </span>
      <label className="flex min-h-[44px] items-center gap-2 text-[13px] sm:min-h-0">
        <input type="checkbox" name="active" defaultChecked={item.active} disabled={pending} />
        Active
      </label>
      <label className="flex min-h-[44px] items-center gap-2 text-[13px] sm:min-h-0">
        <input
          type="checkbox"
          name="onboardingEnabled"
          defaultChecked={item.onboardingEnabled}
          disabled={pending}
        />
        New onboarding
      </label>
      {kind === 'district' ? (
        <label className="flex min-h-[44px] items-center gap-2 text-[13px] sm:min-h-0">
          <input
            type="checkbox"
            name="photographyAvailable"
            defaultChecked={'photographyAvailable' in item && item.photographyAvailable}
            disabled={pending}
          />
          Photography coverage
        </label>
      ) : null}
      <Button size="sm" className="min-h-[44px] sm:min-h-0" type="submit" loading={pending}>
        Save {kind}
      </Button>
    </form>
  );
}

export function ServiceLocationsEditor({
  initial,
  history,
}: {
  initial: ServiceLocationsResponse;
  history: ServiceLocationHistory;
}) {
  const router = useRouter();
  const [catalogue, setCatalogue] = useState(initial);
  const [stateId, setStateId] = useState('IN-TN');
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const selected = catalogue.data.find((state) => state.id === stateId);
  function result(value: ServiceLocationResult) {
    if (value.data) setCatalogue(value.data);
    setNotice({
      ok: value.ok,
      message:
        value.message ??
        'Service locations saved. Existing dealerships and listings are preserved.',
    });
    if (value.ok) router.refresh();
  }
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setAdding(true);
    try {
      const response = await addServiceDistrictAction({
        stateId,
        name: values.get('name'),
        sourceUrl: values.get('sourceUrl'),
        sourceReviewed: values.has('sourceReviewed'),
      });
      result(response);
      if (response.ok) form.reset();
    } finally {
      setAdding(false);
    }
  }
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="service-locations-heading">
      <h2 id="service-locations-heading" className="text-[17px]">
        Service Locations
      </h2>
      <p className="text-[13px] ink-muted">
        State and district eligibility controls new onboarding. Photography coverage is configured
        separately. Enabling a state does not enable its districts.
      </p>
      <label className="text-[13px]" htmlFor="configured-state">
        Configured state or Union Territory
      </label>
      <select
        id="configured-state"
        className="input"
        value={stateId}
        onChange={(event) => setStateId(event.target.value)}
      >
        {catalogue.data.map((state) => (
          <option key={state.id} value={state.id}>
            {state.name}
            {state.onboardingEnabled && state.active ? ' — onboarding enabled' : ''}
          </option>
        ))}
      </select>
      {notice ? <Banner tone={notice.ok ? 'ok' : 'err'}>{notice.message}</Banner> : null}
      {selected ? (
        <>
          <LocationSettings
            key={`${selected.id}-${selected.version}`}
            item={selected}
            kind="state"
            onResult={result}
          />
          <p className="text-[13px] ink-muted">
            {selected.districts.length} configured districts. Inactive districts are retained for
            existing records.
          </p>
          <div className="flex flex-col gap-2">
            {selected.districts.map((district) => (
              <LocationSettings
                key={`${district.id}-${district.version}`}
                item={district}
                kind="district"
                onResult={result}
              />
            ))}
          </div>
          <details className="rounded-lg border border-(--color-divider) p-3">
            <summary className="cursor-pointer text-[14px] font-semibold">
              Add a government-reviewed district
            </summary>
            <form
              className="mt-3 flex flex-col gap-3"
              onSubmit={(event) => {
                void add(event);
              }}
            >
              <p className="text-[13px] ink-muted">
                Check the canonical name and state mapping against the government source before
                adding. New districts start with onboarding and photography disabled.
              </p>
              <label className="text-[13px]">
                Canonical district name
                <input
                  className="input mt-1"
                  name="name"
                  required
                  maxLength={100}
                  disabled={adding}
                />
              </label>
              <label className="text-[13px]">
                Government source URL
                <input
                  className="input mt-1"
                  name="sourceUrl"
                  type="url"
                  required
                  maxLength={500}
                  placeholder="https://district.nic.in/"
                  disabled={adding}
                />
              </label>
              <label className="flex items-start gap-2 text-[13px]">
                <input name="sourceReviewed" type="checkbox" required disabled={adding} />I checked
                the district name and its state against this government source.
              </label>
              <Button type="submit" size="sm" loading={adding}>
                Add district
              </Button>
            </form>
          </details>
        </>
      ) : null}
      <details className="rounded-lg border border-(--color-divider) p-3">
        <summary className="cursor-pointer text-[14px] font-semibold">
          Configuration audit history
        </summary>
        <ul className="mt-3 flex flex-col gap-2 text-[12px]">
          {history.data.map((entry) => (
            <li key={entry.id} className="break-words">
              <time dateTime={entry.at}>{entry.at.replace('T', ' ').replace('Z', ' UTC')}</time> ·{' '}
              {entry.action === 'service_location.district_added'
                ? 'District added'
                : 'Location settings updated'}{' '}
              · {entry.entityId}
              <p className="mt-1 ink-muted">Before: {auditSummary(entry.before)}</p>
              <p className="ink-muted">After: {auditSummary(entry.after)}</p>
            </li>
          ))}
        </ul>
        {history.data.length === 0 ? (
          <p className="mt-2 text-[13px] ink-muted">No location configuration changes recorded.</p>
        ) : null}
      </details>
    </section>
  );
}
