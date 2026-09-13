import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { revalidations } from '../../../setup.js';
import { updateConfigAction } from '../../../../src/features/admin/config-actions.js';

/**
 * F072 — one setting, written with its declared type.
 *
 * The control hands this action a **string**, because every HTML input does.
 * Turning it back into the type the key declares is this file's whole job, and
 * getting it wrong is not a visible bug: `platform_config.value` is a JSON
 * column, so `"18"` where `18` belongs is stored happily and read back by
 * `config.number()` as `NaN` — which surfaces days later as a GST figure nobody
 * can account for.
 */
const ORIGINAL_FETCH = globalThis.fetch;

function respond(status: number, body: unknown = {}): typeof fetch {
  const reply = {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: { getSetCookie: () => [] },
  } as unknown as Response;

  return vi.fn(() => Promise.resolve(reply));
}

function sentBody(): unknown {
  const call = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
  const init = call?.[1] as { body: string };
  return JSON.parse(init.body);
}

beforeEach(() => {
  globalThis.fetch = respond(200, { data: [] });
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('updateConfigAction', () => {
  it('sends a number as a number', async () => {
    await updateConfigAction('billing.gstPercent', 'number', '12');

    expect(sentBody()).toEqual({ value: 12 });
  });

  it('sends a boolean as a boolean', async () => {
    await updateConfigAction('feature.similarCars', 'boolean', 'false');

    expect(sentBody()).toEqual({ value: false });
  });

  /** One entry per line, blank lines dropped — a trailing newline is not an entry. */
  it('splits a string list on newlines and drops the empty ones', async () => {
    await updateConfigAction(
      'listing.rejectionReasonPresets',
      'string[]',
      'Too few photos.\n\n  Price is implausible.  \n',
    );

    expect(sentBody()).toEqual({ value: ['Too few photos.', 'Price is implausible.'] });
  });

  it('refuses a number that is not one, without a round trip', async () => {
    const result = await updateConfigAction('billing.gstPercent', 'number', 'twelve');

    expect(result).toEqual({ ok: false, message: 'That is not a number.' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('refreshes the settings screen on success', async () => {
    await updateConfigAction('billing.gstPercent', 'number', '12');

    expect(revalidations.paths).toContain('/admin/config');
  });

  it('reports the server’s refusal rather than a generic one', async () => {
    globalThis.fetch = respond(422, {
      type: 'about:blank',
      title: 'Config type mismatch',
      status: 422,
      code: 'CONFIG_TYPE_MISMATCH',
      detail: 'billing.gstPercent is a number, and this value is not one.',
    });

    const result = await updateConfigAction('billing.gstPercent', 'number', '12');

    expect(result.ok).toBe(false);
    expect(result.message).toContain('number');
  });
});
