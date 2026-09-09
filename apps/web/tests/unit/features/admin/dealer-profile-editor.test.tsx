import type { AdminDealerDetail } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DealerProfileEditor } from '@/features/admin/dealer-profile-editor';

/**
 * R32 — the two fields the review screen shows, and the one it no longer does.
 *
 * `About` was the last box on the platform reading a paragraph the product
 * stopped collecting: R25 took it off the public portfolio, R26 off onboarding
 * and off the dealer's own profile screen. What replaced it there is what
 * replaces it here — the tagline and the service list, which are what a
 * moderator is actually being asked to judge, because they are the free text a
 * dealership typed that a buyer will read.
 */
const updateDealerAction = vi.fn();

vi.mock('@/features/admin/actions', () => ({
  updateDealerAction: (id: string, patch: unknown) => updateDealerAction(id, patch) as unknown,
}));

const DEALER = {
  id: '3c8f2b10-1111-4222-8333-444455556666',
  legalName: 'Sri Lakshmi Motors Pvt Ltd',
  gstin: '33AABCS1429B1ZX',
  pan: 'AABCS1429B',
  addressLine: '12 Katpadi Road',
  city: 'Vellore',
  district: 'Vellore',
  state: 'Tamil Nadu',
  pincode: '632001',
  mapsUrl: 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
  contactName: 'Ramesh Kumar',
  contactPhone: '9840012345',
  contactPhoneDisplay: '+91 98400 12345',
  contactEmail: 'owner@sri-lakshmi-motors.in',
  landline: '0416 224 8890',
  tagline: 'Family-run since 1998 — hatchbacks under ₹6 lakh.',
  specialities: ['In-house workshop', 'RC transfer assistance'],
  actions: { canEdit: true },
} as unknown as AdminDealerDetail;

const editor = (overrides: Partial<AdminDealerDetail> = {}) =>
  render(<DealerProfileEditor dealer={{ ...DEALER, ...overrides }} />);

describe('the review screen’s business card', () => {
  beforeEach(() => {
    updateDealerAction.mockReset();
    updateDealerAction.mockResolvedValue({ ok: true });
  });

  it('shows the tagline and the services, and no About row', () => {
    editor();

    expect(screen.getByText('Tagline')).toBeInTheDocument();
    expect(screen.getByText(/Family-run since 1998/)).toBeInTheDocument();
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('In-house workshop')).toBeInTheDocument();
    expect(screen.getByText('RC transfer assistance')).toBeInTheDocument();
    expect(screen.queryByText('About')).toBeNull();
  });

  /**
   * As chips rather than as the comma string the box holds. A moderator is
   * comparing this against the public page, where they are chips, and the shape
   * is what makes a dealership that typed one seventy-word "service" obvious at
   * a glance rather than on a character count.
   */
  it('reads the services as chips', () => {
    const { container } = editor();

    expect([...container.querySelectorAll('.tag')].map((chip) => chip.textContent)).toEqual([
      'In-house workshop',
      'RC transfer assistance',
    ]);
  });

  /**
   * Every empty field reads `—` rather than disappearing: the reviewer's
   * question is often "what has *not* been answered", and a row that vanishes
   * cannot answer it. Both of these are empty on every row that predates R26.
   */
  it('says so when a dealership has neither', () => {
    const { container } = editor({ tagline: null, specialities: [] });

    expect(container.querySelectorAll('.tag')).toHaveLength(0);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  /**
   * The load-bearing half of `list: true`. `UpdateDealerInput.specialities` is
   * an array and the box is one comma-separated line, so a patch that sent the
   * string would be a `.strict()` 400 rather than a save.
   */
  it('sends the services as an array, not as the line the box holds', async () => {
    const user = userEvent.setup();
    editor();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const box = screen.getByLabelText(/services/i);
    await user.clear(box);
    await user.type(box, 'In-house workshop, RC transfer assistance, Bank loan tie-ups');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateDealerAction).toHaveBeenCalledTimes(1);
    expect(updateDealerAction.mock.calls[0]?.[1]).toEqual({
      specialities: ['In-house workshop', 'RC transfer assistance', 'Bank loan tie-ups'],
    });
  });

  /** A blank entry from a trailing comma is dropped, not sent as `''`. */
  it('drops the empty entry a trailing comma leaves behind', async () => {
    const user = userEvent.setup();
    editor();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const box = screen.getByLabelText(/services/i);
    await user.clear(box);
    await user.type(box, 'Exchange, , RC transfer,');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateDealerAction.mock.calls[0]?.[1]).toEqual({
      specialities: ['Exchange', 'RC transfer'],
    });
  });

  /** The other new field, sent as itself. */
  it('sends the tagline as a string', async () => {
    const user = userEvent.setup();
    editor();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const box = screen.getByLabelText(/tagline/i);
    await user.clear(box);
    await user.type(box, 'Only diesel SUVs, every one with a full service history.');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateDealerAction.mock.calls[0]?.[1]).toEqual({
      tagline: 'Only diesel SUVs, every one with a full service history.',
    });
  });

  /**
   * A refusal about one entry in a list arrives as `specialities.3`, which none
   * of the four exact lookups match. Without the index clause the box a
   * moderator has to fix is the one box with no message on it: the form says
   * "those changes did not save" and nothing says which service is at fault.
   */
  it('renders a refusal about one service against the services box', async () => {
    const user = userEvent.setup();
    updateDealerAction.mockResolvedValue({
      ok: false,
      message: 'Some of those details are not valid.',
      errors: { 'specialities.1': 'Keep each service to a short label — 60 characters at most.' },
    });
    editor();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const box = screen.getByLabelText(/services/i);
    await user.clear(box);
    await user.type(box, 'Exchange, RC transfer');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/60 characters at most/)).toBeInTheDocument();
  });
});
