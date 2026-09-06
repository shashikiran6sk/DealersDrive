'use client';

import type { AdminDealerDetail } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Banner } from '@/components/ui/primitives';
import { updateDealerAction } from '@/features/admin/actions';

/**
 * D3 — the dealership's own answers, editable from the review screen.
 *
 * The screen showed them as a definition list, which is right for the ninety
 * percent of reviews that end in a decision and wrong for the ten that end in a
 * correction. A moderator holding the GST certificate can see that the dealer
 * typed one digit of the GSTIN wrong, or spelt the district `Vellore Dist.`; the
 * alternative to fixing it here is a round trip that costs a working day per
 * character. So the same fields the dealer filled in are writable here.
 *
 * **It reads before it writes.** The form is a display until *Edit* is pressed,
 * because a review screen full of live inputs invites edits that were meant to
 * be readings — and because the same values are what a reviewer is comparing
 * against a document. Cancel restores what the API last said.
 *
 * **Only what changed is sent.** `UpdateDealerInput` is partial, so the patch is
 * the diff against the values this component was rendered with. That is not an
 * optimisation: sending the whole form would re-write `legalName` and `city`
 * with the same values on every save, and the duplicate-name check would then
 * have to be told to ignore a collision with the row being edited on a field
 * nobody touched.
 *
 * The API is the authority on all of it. Every one of these fields goes through
 * the same `dealers.update` the dealer's own `PATCH /v1/dealer` does — locality
 * normalisation, the E.164 rewrite, the name-within-a-city uniqueness check —
 * and a refusal comes back naming the field, which is what `errors` renders
 * against.
 */

/**
 * The fields, and where each one lives in `UpdateDealerInput`.
 *
 * One table rather than one JSX block per input: the form, the initial values,
 * the diff and the error mapping all walk it, and a field added to a form but
 * forgotten in the diff is the kind of bug that looks like "the console did not
 * save my change" and gets reported as flakiness.
 *
 * `path` is the dotted path the API answers errors against, minus the `body.`
 * prefix — so `address.city` matches `body.address.city`.
 */
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
  /*
   * The one field on this card written for a reader rather than for a form, so
   * it is the one that is laid out differently: a textarea across both columns
   * while editing, and a wrapped paragraph rather than a right-aligned value
   * while reading. It is also the field most likely to need a reviewer's hand —
   * a phone number smuggled into the prose is exactly the sort of thing rule 7
   * exists to keep off a public page.
   */
  { key: 'about', label: 'About', path: 'about', mono: false, multiline: true },
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
    about: dealer.about ?? '',
  };
}

/**
 * The dotted paths that changed, folded back into the nested shape the schema
 * wants. An unchanged field is absent rather than sent as itself — see the note
 * on the component above.
 */
function patchOf(values: Values, initial: Values): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const field of FIELDS) {
    const next = values[field.key].trim();
    if (next === initial[field.key].trim()) continue;

    const [head, leaf] = field.path.split('.');
    if (leaf === undefined) {
      patch[head as string] = next;
      continue;
    }
    const group = (patch[head as string] as Record<string, unknown> | undefined) ?? {};
    group[leaf] = next;
    patch[head as string] = group;
  }

  return patch;
}

/** `body.address.city` → the `address.city` row. Also matches a bare leaf. */
function errorFor(errors: Record<string, string>, path: string): string | undefined {
  const leaf = path.split('.').pop() ?? path;
  return errors[path] ?? errors[`body.${path}`] ?? errors[leaf] ?? errors[`body.${leaf}`];
}

export function DealerProfileEditor({ dealer }: { dealer: AdminDealerDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Values>(() => initialValues(dealer));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  /*
   * What the API last said, as the baseline the diff is taken against.
   *
   * Re-derived during render when the prop changes rather than in an effect,
   * because `router.refresh()` after a save delivers the new dealership as a
   * render: reconciling in an effect would leave one paint in which the form
   * still holds the values the *previous* save was diffed from, and the next
   * edit would be diffed against a stale baseline.
   */
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
      // The server re-reads the dealership; `source` above picks the new values
      // up on the render that follows.
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
              error={errorFor(errors, field.path)}
              className={'multiline' in field ? 'sm:col-span-2' : undefined}
            >
              {'multiline' in field ? (
                <Textarea
                  id={`dealer-${field.key}`}
                  rows={4}
                  maxLength={4000}
                  value={values[field.key]}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                />
              ) : (
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
              )}
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
            'multiline' in field ? (
              /*
                A paragraph does not belong in the label-on-the-left, value-on-
                the-right rhythm the rest of the list keeps: at 13px it wraps to
                four ragged right-aligned lines. Stacked and left-aligned, with
                the dealer's own line breaks preserved, it reads the way it will
                read on the portfolio — which is the thing the reviewer is
                actually being asked to judge.
              */
              <div
                key={field.key}
                className="border-b border-(--color-divider) py-[9px] text-[13px] last:border-b-0"
              >
                <dt className="ink-muted">{field.label}</dt>
                <dd className="mt-[4px] whitespace-pre-line font-medium">
                  {initial[field.key] || '—'}
                </dd>
              </div>
            ) : (
              <div
                key={field.key}
                className="flex justify-between gap-4 border-b border-(--color-divider) py-[9px] text-[13px] last:border-b-0"
              >
                <dt className="ink-muted">{field.label}</dt>
                <dd className={`text-right font-medium${field.mono ? ' font-mono' : ''}`}>
                  {/*
                  The phone is shown formatted while it is being read and raw
                  while it is being edited — `+91 98400 12345` is what a reviewer
                  is checking against a letterhead, and `9840012345` is what the
                  field accepts back.
                */}
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
