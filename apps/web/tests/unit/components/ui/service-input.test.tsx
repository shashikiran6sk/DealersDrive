import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ServiceInput } from '@/components/ui/service-input';

/**
 * The services editor (**R37**).
 *
 * Two things are worth testing here and they are not the same thing:
 *
 *   · **what the dealer sees** — a chip per service, a way to remove each one,
 *     and a refusal to add the same service twice;
 *   · **what the form submits** — one comma-separated string under `name`,
 *     byte-for-byte what the old text box submitted, because `servicesOf()` on
 *     the far side was not changed and must not need to be.
 *
 * The second is the one that would fail silently in production, so it is
 * asserted on the hidden input after every interaction rather than once.
 */
function setup(props: Partial<React.ComponentProps<typeof ServiceInput>> = {}) {
  const user = userEvent.setup();
  const view = render(
    <form>
      <label htmlFor="services">Services</label>
      <ServiceInput id="services" name="specialities" value={[]} {...props} />
    </form>,
  );
  const hidden = (): HTMLInputElement | null =>
    view.container.querySelector('input[type="hidden"][name="specialities"]');
  const chips = () => within(screen.getByRole('group', { name: /services added/i }));
  return { user, view, hidden, chips };
}

describe('adding one at a time', () => {
  it('turns the draft into a chip when Add is pressed', async () => {
    const { user, hidden, chips } = setup();

    await user.type(screen.getByLabelText('Services'), 'RC transfer');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(chips().getByText('RC transfer')).toBeInTheDocument();
    expect(hidden()).toHaveValue('RC transfer');
    // The box is empty and ready for the next one, rather than holding a value
    // that is now also a chip.
    expect(screen.getByLabelText('Services')).toHaveValue('');
  });

  /** Enter is what a person types after a short answer. It must not submit. */
  it('adds on Enter without submitting the form', async () => {
    const { user, view, hidden } = setup();
    let submitted = false;
    view.container.querySelector('form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
    });

    await user.type(screen.getByLabelText('Services'), 'Exchange{Enter}');

    expect(hidden()).toHaveValue('Exchange');
    expect(submitted).toBe(false);
  });

  /** Add is dead while the box is empty, so it cannot add nothing. */
  it('disables Add until something is typed', async () => {
    const { user } = setup();

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    await user.type(screen.getByLabelText('Services'), 'Finance');
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  });

  /**
   * A dealer pasting their list out of WhatsApp gets chips, not one chip sixty
   * characters long that the contract then refuses.
   */
  it('splits a pasted comma-separated list', async () => {
    const { user, hidden, chips } = setup();

    await user.type(screen.getByLabelText('Services'), 'Finance, Exchange, RC transfer,');

    expect(chips().getByText('Finance')).toBeInTheDocument();
    expect(chips().getByText('Exchange')).toBeInTheDocument();
    expect(chips().getByText('RC transfer')).toBeInTheDocument();
    expect(hidden()).toHaveValue('Finance, Exchange, RC transfer');
  });
});

describe('refusing a duplicate', () => {
  it('does not add the same service twice', async () => {
    const { user, hidden, chips } = setup({ value: ['Exchange'] });

    await user.type(screen.getByLabelText('Services'), 'Exchange{Enter}');

    expect(chips().getAllByText('Exchange')).toHaveLength(1);
    expect(hidden()).toHaveValue('Exchange');
    expect(screen.getByText(/already added that one/i)).toBeInTheDocument();
  });

  /**
   * Case-insensitively, because "RC transfer" and "RC Transfer" are one service
   * — and a buyer comparing two dealerships should not be shown both.
   */
  it('treats a difference of case as the same service', async () => {
    const { user, hidden } = setup({ value: ['RC transfer'] });

    await user.type(screen.getByLabelText('Services'), 'rc TRANSFER{Enter}');

    expect(hidden()).toHaveValue('RC transfer');
  });

  /** A refused entry stays in the box: there is nothing to retype. */
  it('keeps the draft when every entry was refused', async () => {
    const { user } = setup({ value: ['Exchange'] });

    await user.type(screen.getByLabelText('Services'), 'Exchange{Enter}');

    expect(screen.getByLabelText('Services')).toHaveValue('Exchange');
  });
});

describe('removing', () => {
  it('takes a chip out and off the submitted value', async () => {
    const { user, hidden, chips } = setup({ value: ['Finance', 'Exchange'] });

    await user.click(screen.getByRole('button', { name: 'Remove Finance' }));

    expect(chips().queryByText('Finance')).toBeNull();
    expect(hidden()).toHaveValue('Exchange');
  });

  /** A locked editor (the R34 waiting-for-review state) offers no way out. */
  it('offers no remove control when disabled', () => {
    setup({ value: ['Finance'], disabled: true });

    expect(screen.queryByRole('button', { name: /^Remove /i })).toBeNull();
    expect(screen.getByLabelText('Services')).toBeDisabled();
  });
});

describe('the ceiling', () => {
  const TWELVE = Array.from({ length: 12 }, (_, index) => `Service ${String(index + 1)}`);

  it('shuts the box at the limit rather than refusing on save', async () => {
    setup({ value: TWELVE });

    expect(screen.getByLabelText('Services')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByPlaceholderText(/12 services is the limit/i)).toBeInTheDocument();
    await Promise.resolve();
  });

  it('refuses an entry longer than the contract allows', async () => {
    const { user, hidden } = setup();

    await user.type(screen.getByLabelText('Services'), `${'x'.repeat(61)}{Enter}`);

    // `maxLength` on the box is the first defence, so 61 characters cannot even
    // be typed — the value is clipped to 60 and is therefore accepted.
    expect(hidden()).toHaveValue('x'.repeat(60));
  });
});

describe('what reaches the server', () => {
  /**
   * The failure this prevents is the most natural mistake on the screen: type a
   * service, press Continue, and watch it vanish. A form serialises the hidden
   * input's value, and a `setState` in a submit handler has not flushed by
   * then — so the value is written to the DOM node directly.
   */
  it('commits a draft the dealer typed but did not add', async () => {
    const { user, view, hidden } = setup({ value: ['Finance'] });
    const form = view.container.querySelector('form');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
    });

    await user.type(screen.getByLabelText('Services'), 'Exchange');
    form?.requestSubmit();

    expect(hidden()).toHaveValue('Finance, Exchange');
  });

  /** `required` sits on the visible box, which is the one a browser can focus. */
  it('requires an answer only while the list is empty', async () => {
    const { user } = setup({ required: true });

    expect(screen.getByLabelText('Services')).toBeRequired();
    await user.type(screen.getByLabelText('Services'), 'Finance{Enter}');
    expect(screen.getByLabelText('Services')).not.toBeRequired();
  });

  /** No `name` means no hidden input at all — the R34 lock, from the far side. */
  it('submits nothing when it has no name', () => {
    const { view } = setup({ name: undefined, value: ['Finance'] });

    expect(view.container.querySelector('input[type="hidden"]')).toBeNull();
  });
});
