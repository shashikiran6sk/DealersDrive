import { REGISTRATION_MESSAGES } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PlateInput } from '@/components/forms/plate-input';

function setup(props: Partial<React.ComponentProps<typeof PlateInput>> = {}) {
  const user = userEvent.setup();
  render(
    <form>
      <PlateInput id="registrationNumber" {...props} />
      <button type="button">elsewhere</button>
    </form>,
  );
  const input = screen.getByLabelText(/registration number/i);
  if (!(input instanceof HTMLInputElement)) throw new Error('expected an input');
  return { user, input };
}

describe('PlateInput', () => {
  it('rewrites a valid plate into its readable form on blur', async () => {
    const { user, input } = setup();

    await user.type(input, 'ka-1-ab-1');
    await user.tab();

    expect(input.value).toBe('KA 01 AB 0001');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('says what is wrong with a plate it cannot read, beside the field', async () => {
    const { user, input } = setup();

    await user.type(input, 'ZZ 01 AB 1234');
    await user.tab();

    expect(screen.getByText(REGISTRATION_MESSAGES.state)).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'registrationNumber-error');
  });

  it('clears its own message as soon as the dealer types again', async () => {
    const { user, input } = setup();

    await user.type(input, 'KA 01 AB 0000');
    await user.tab();
    expect(screen.getByText(REGISTRATION_MESSAGES.zero)).toBeInTheDocument();

    await user.type(input, '1');
    expect(screen.queryByText(REGISTRATION_MESSAGES.zero)).not.toBeInTheDocument();
  });

  it('says nothing about an empty field until the form is submitted', async () => {
    const { user, input } = setup();

    await user.click(input);
    await user.tab();

    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('shows the server’s refusal when there is no local one', () => {
    setup({ error: 'You already have a vehicle with this registration number.' });

    expect(
      screen.getByText('You already have a vehicle with this registration number.'),
    ).toBeInTheDocument();
  });

  it('formats a stored canonical value for display and submits under its name', () => {
    const { input } = setup({ defaultValue: 'TN09BX1234', name: 'plate' });

    expect(input.value).toBe('TN 09 BX 1234');
    expect(input).toHaveAttribute('name', 'plate');
  });

  it('can be disabled', () => {
    const { input } = setup({ disabled: true });
    expect(input).toBeDisabled();
  });
});
