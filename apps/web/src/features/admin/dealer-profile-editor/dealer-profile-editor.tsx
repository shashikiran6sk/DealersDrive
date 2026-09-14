'use client';

import type { AdminDealerDetail } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import { updateDealerAction } from '@/features/admin/actions';

import { DealerDetailForm } from './dealer-detail-form';
import { DealerDetailList } from './dealer-detail-list';
import { DEALER_EDITOR_TEXT } from './dealer-profile-editor.constants';
import type { FieldKey, Values } from './dealer-profile-editor.types';
import { initialValues, patchOf } from './utils';

/**
 * D3 — the dealership's own answers, editable from the review screen.
 *
 * The screen showed them as a definition list, which is right for the ninety
 * percent of reviews that end in a decision and wrong for the ten that end in a
 * correction: a moderator holding the GST certificate can see that the dealer
 * typed one digit of the GSTIN wrong, and the alternative to fixing it here is a
 * round trip that costs a working day per character.
 *
 * **It reads before it writes**, because a review screen full of live inputs
 * invites edits that were meant to be readings. Cancel restores what the API last
 * said. **Only what changed is sent** — see `patchOf`.
 *
 * The API is the authority on all of it: every field goes through the same
 * `dealers.update` the dealer's own `PATCH /v1/dealer` does, and a refusal comes
 * back naming the field.
 */
export function DealerProfileEditor({ dealer }: { dealer: AdminDealerDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Values>(() => initialValues(dealer));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  /*
   * What the API last said, as the baseline the diff is taken against. Re-derived
   * during render when the prop changes rather than in an effect, because
   * `router.refresh()` after a save delivers the new dealership as a render:
   * reconciling in an effect would leave one paint in which the form still holds
   * the values the *previous* save was diffed from.
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
        setMessage(result.message ?? DEALER_EDITOR_TEXT.saveFailed);
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

  function change(key: FieldKey, value: string): void {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="card gap-0 p-4">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-[19px]">{DEALER_EDITOR_TEXT.heading}</h2>
        {dealer.actions.canEdit ? (
          editing ? (
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={cancel} disabled={pending}>
                {DEALER_EDITOR_TEXT.cancel}
              </Button>
              <Button variant="primary" size="sm" loading={pending} disabled={!dirty} onClick={save}>
                {DEALER_EDITOR_TEXT.save}
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="ml-auto"
              onClick={() => setEditing(true)}
            >
              {DEALER_EDITOR_TEXT.edit}
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
          {DEALER_EDITOR_TEXT.saved}
        </Banner>
      ) : null}

      {editing ? (
        <DealerDetailForm values={values} errors={errors} onChange={change} />
      ) : (
        <DealerDetailList values={initial} contactPhoneDisplay={dealer.contactPhoneDisplay} />
      )}
    </section>
  );
}
