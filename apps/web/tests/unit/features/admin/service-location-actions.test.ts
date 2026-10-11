import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { revalidations } from '../../../setup.js';
import {
  addServiceDistrictAction,
  updateServiceLocationAction,
} from '@/features/admin/service-location-actions';
import { loadServiceLocationsAction } from '@/features/service-location-actions';
const original = globalThis.fetch;
function respond(status: number, body: unknown) {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
      headers: { getSetCookie: () => [] },
    } as unknown as Response),
  );
}
beforeEach(() => {
  respond(200, { data: [] });
});
afterEach(() => {
  globalThis.fetch = original;
});
describe('service location actions', () => {
  it('loads the validated live catalogue without browser or Next cache', async () => {
    expect(await loadServiceLocationsAction()).toEqual({ data: [] });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/service-locations'),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
  it('sends the version and independent switches and refreshes configuration', async () => {
    const input = {
      expectedVersion: 2,
      active: true,
      onboardingEnabled: false,
      photographyAvailable: true,
    };
    expect(await updateServiceLocationAction('district', 'IN-TN-VELLORE', input)).toMatchObject({
      ok: true,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/district/IN-TN-VELLORE'),
      expect.objectContaining({ body: JSON.stringify(input) }),
    );
    expect(revalidations.paths).toContain('/admin/config');
  });
  it('refuses invalid or unreviewed input without making a request', async () => {
    expect(
      await updateServiceLocationAction('state', 'IN-TN', { expectedVersion: 0 }),
    ).toMatchObject({ ok: false });
    expect(
      await addServiceDistrictAction({
        stateId: 'IN-TN',
        name: 'QA',
        sourceUrl: 'https://example.test/',
        sourceReviewed: false,
      }),
    ).toMatchObject({ ok: false });
    expect(
      await addServiceDistrictAction({
        stateId: 'IN-TN',
        name: 'QA',
        sourceUrl: 'not a url',
        sourceReviewed: true,
      }),
    ).toMatchObject({ ok: false });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('returns a backend conflict clearly and makes no success claim', async () => {
    respond(409, { code: 'LOCATION_VERSION_CONFLICT', detail: 'Reload before saving.' });
    expect(
      await updateServiceLocationAction('state', 'IN-TN', {
        expectedVersion: 1,
        active: true,
        onboardingEnabled: false,
      }),
    ).toMatchObject({ ok: false, message: 'Reload before saving.' });
  });
  it('submits reviewed district source metadata', async () => {
    const input = {
      stateId: 'IN-KA',
      name: 'Reviewed District',
      sourceUrl: 'https://district.nic.in/',
      sourceReviewed: true,
    };
    expect(await addServiceDistrictAction(input)).toMatchObject({ ok: true });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/service-locations/districts'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });
});
