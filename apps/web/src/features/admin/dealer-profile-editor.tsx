'use client';

import type { AdminDealerDetail } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banner, Tag } from '@/components/ui/primitives';
import { updateDealerAction } from '@/features/admin/actions';
import { servicesOf } from '@/lib/services';

const FIELDS = [
  { key: 'legalName', label: 'Dealership name', path: 'legalName', mono: false },
  { key: 'gstin', label: 'GSTIN', path: 'gstin', mono: true, transform: upper },
  { key: 'pan', label: 'PAN', path: 'pan', mono: true, transform: upper },
  { key: 'addressLine', label: 'Address', path: 'address.line', mono: false },
  { key: 'city', label: 'City', path: 'address.city', mono: false },
  { key: 'district', label: 'District', path: 'address.district', mono: false },
  { key: 'state', label: 'State', path: 'address.state', mono: false },
  { key: 'pincode', label: 'Pincode', path: 'address.pincode', mono: true },
  { key: 'mapsUrl', label: 'Google Maps location', path: 'address.mapsUrl', mono: false },
  { key: 'contactName', label: 'Contact', path: 'contact.fullName', mono: false },
  { key: 'contactPhone', label: 'Phone', path: 'contact.phone', mono: true },
  { key: 'contactEmail', label: 'Email', path: 'contact.email', mono: false },
  { key: 'landline', label: 'Landline', path: 'contact.landline', mono: true },
  { key: 'tagline', label: 'Tagline', path: 'tagline', mono: false, wide: true },
  {
    key: 'specialities',
    label: 'Services',
    path: 'specialities',
    mono: false,
    wide: true,
    list: true,
  },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];
type Values = Record<FieldKey, string>;

function upper(value: string): string {
  return value.toUpperCase();
}

function initialValues(dealer: AdminDealerDetail): Values {
  return {
    legalName: dealer.legalName,
    gstin: dealer.gstin ?? '',
    pan: dealer.pan ?? '',
    addressLine: dealer.addressLine ?? '',
    city: dealer.city ?? '',
    district: dealer.district ?? '',
    state: dealer.state ?? '',
    pincode: dealer.pincode ?? '',
    mapsUrl: dealer.mapsUrl ?? '',
    contactName: dealer.contactName ?? '',
    contactPhone: dealer.contactPhone ?? '',
    contactEmail: dealer.contactEmail ?? '',
    landline: dealer.landline ?? '',
    tagline: dealer.tagline ?? '',
    specialities: dealer.specialities.join(', '),
  };
}

function patchOf(values: Values, initial: Values): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const field of FIELDS) {
    const next = values[field.key].trim();
    if (next === initial[field.key].trim()) continue;

    const [head, leaf] = field.path.split('.');
    if (leaf === undefined) {
      patch[head as string] = 'list' in field ? servicesOf(next) : next;
      continue;
    }
    const group = (patch[head as string] as Record<string, unknown> | undefined) ?? {};
    group[leaf] = next;
    patch[head as string] = group;
  }

  return patch;
}

function errorFor(errors: Record<string, string>, path: string): string | undefined {
  const leaf = path.split('.').pop() ?? path;
  const exact = errors[path] ?? errors[`body.${path}`] ?? errors[leaf] ?? errors[`body.${leaf}`];
  if (exact !== undefined) return exact;

  const beneath = Object.entries(errors).find(
    ([key]) => key.startsWith(`${path}.`) || key.startsWith(`body.${path}.`),
  );
  return beneath?.[1];
}

export function DealerProfileEditor({ dealer }: { dealer: AdminDealerDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Values>(() => initialValues(dealer));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [source, setSource] = useState(dealer);
  if (source !== dealer) {
    setSource(dealer);
    if (!editing) setValues(initialValues(dealer));
  }

  const initial = initialValues(source);
  const patch = patchOf(values, initial);
  const dirty = Object.keys(patch).length > 0;

  function cancel(): void {
    setValues(initialValues(source));
    setErrors({});
    setMessage(null);
    setEditing(false);
  }

  function save(): void {
    setErrors({});
    setMessage(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateDealerAction(dealer.id, patch);
      if (!result.ok) {
        setMessage(result.message ?? 'Those changes did not save.');
        setErrors(result.errors ?? {});
        return;
      }
      setSaved(true);
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <section className="card gap-0 p-4">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-[19px]">Business</h2>
        {dealer.actions.canEdit ? (
          editing ? (
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={cancel} disabled={pending}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={pending}
                disabled={!dirty}
                onClick={save}
              >
                Save changes
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="ml-auto"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          )
        ) : null}
      </div>

      {message ? (
        <Banner tone="err" className="mb-2">
          {message}
        </Banner>
      ) : null}
      {saved && !editing ? (
        <Banner tone="ok" className="mb-2">
          Saved. The dealer sees these details from now on.
        </Banner>
      ) : null}

      {editing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <Field
              key={field.key}
              id={`dealer-${field.key}`}
              label={field.label}
              hint={'list' in field ? 'comma separated, up to 12' : undefined}
              error={errorFor(errors, field.path)}
              className={'wide' in field ? 'sm:col-span-2' : undefined}
            >
              <Input
                id={`dealer-${field.key}`}
                className={field.mono ? 'font-mono' : undefined}
                value={values[field.key]}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.key]:
                      'transform' in field
                        ? field.transform(event.target.value)
                        : event.target.value,
                  }))
                }
              />
            </Field>
          ))}
          <p className="text-[12px] ink-muted sm:col-span-2">
            Only the fields you change are sent. Leaving one blank clears it where the dealer is
            allowed to have it blank, and is refused where they are not.
          </p>
        </div>
      ) : (
        <dl>
          {FIELDS.map((field) =>
            'wide' in field ? (
              <div
                key={field.key}
                className="border-b border-(--color-divider) py-[9px] text-[13px] last:border-b-0"
              >
                <dt className="ink-muted">{field.label}</dt>
                <dd className="mt-[4px] font-medium">
                  {'list' in field ? (
                    servicesOf(initial[field.key]).length > 0 ? (
                      <span className="flex flex-wrap gap-[6px]">
                        {servicesOf(initial[field.key]).map((service) => (
                          <Tag key={service} variant="neutral" className="text-[11px]">
                            {service}
                          </Tag>
                        ))}
                      </span>
                    ) : (
                      '—'
                    )
                  ) : (
                    initial[field.key] || '—'
                  )}
                </dd>
              </div>
            ) : (
              <div
                key={field.key}
                className="flex justify-between gap-4 border-b border-(--color-divider) py-[9px] text-[13px] last:border-b-0"
              >
                <dt className="ink-muted">{field.label}</dt>
                <dd className={`text-right font-medium${field.mono ? ' font-mono' : ''}`}>
                  {field.key === 'contactPhone'
                    ? (dealer.contactPhoneDisplay ?? '—')
                    : initial[field.key] || '—'}
                </dd>
              </div>
            ),
          )}
        </dl>
      )}
    </section>
  );
}
