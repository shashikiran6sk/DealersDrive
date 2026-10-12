import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { VehicleMakeSelect, matchMakes } from '@/components/forms/vehicle-make-select';

function renderInForm(defaultValue?: string) {
  const { container } = render(
    <form>
      <label htmlFor="make">Make</label>
      <VehicleMakeSelect id="make" defaultValue={defaultValue} required />
      <button type="button">Next field</button>
    </form>,
  );
  const posted = () => new FormData(container.querySelector('form') ?? undefined).get('make');
  return { posted, box: screen.getByRole('combobox', { name: 'Make' }) };
}

describe('VehicleMakeSelect', () => {
  it('searches the canonical list and posts the chosen brand', async () => {
    const user = userEvent.setup();
    const { posted, box } = renderInForm();
    expect(box).toHaveAttribute('aria-required', 'true');

    await user.type(box, 'marut');
    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Maruti Suzuki']);
    await user.click(screen.getByRole('button', { name: 'Maruti Suzuki' }));

    expect(box).toHaveValue('Maruti Suzuki');
    expect(posted()).toBe('Maruti Suzuki');
  });

  it('chooses with the keyboard', async () => {
    const user = userEvent.setup();
    const { posted, box } = renderInForm();
    await user.type(box, 'benz');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(posted()).toBe('Mercedes-Benz');
  });

  it('resolves a typed alias to its brand when the field is left', async () => {
    const user = userEvent.setup();
    const { posted, box } = renderInForm();
    await user.type(box, 'tata motors');
    await user.click(screen.getByRole('button', { name: 'Next field' }));
    expect(box).toHaveValue('Tata');
    expect(posted()).toBe('Tata');
  });

  it('never posts an unresolved search; it falls back to the last choice', async () => {
    const user = userEvent.setup();
    const { posted, box } = renderInForm('Hyundai');
    await user.clear(box);
    await user.type(box, 'Hyunda');
    expect(screen.getByRole('listbox', { name: 'Makes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next field' }));
    expect(box).toHaveValue('Hyundai');
    expect(posted()).toBe('Hyundai');
  });

  it('shows a stored alias as its brand', () => {
    const { posted, box } = renderInForm('MARUTI SUZUKI INDIA LTD');
    expect(box).toHaveValue('Maruti Suzuki');
    expect(posted()).toBe('Maruti Suzuki');
  });

  it('keeps a make saved before the list, offered as saved', async () => {
    const user = userEvent.setup();
    const { posted, box } = renderInForm('Hindustan Ambassador Co');
    expect(posted()).toBe('Hindustan Ambassador Co');
    await user.click(box);
    expect(screen.getAllByRole('option')[0]).toHaveTextContent(
      'Hindustan Ambassador Co (as saved)',
    );
  });

  it('says so when nothing matches', async () => {
    const user = userEvent.setup();
    const { box } = renderInForm();
    await user.type(box, 'zzzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText(/No make matches/)).toBeInTheDocument();
  });
});

describe('matchMakes', () => {
  it('matches substrings and exact aliases, never a misspelling', () => {
    expect(matchMakes('rover')).toEqual(['Land Rover']);
    expect(matchMakes('M&M')).toEqual(['Mahindra']);
    expect(matchMakes('Marutii')).toEqual([]);
    expect(matchMakes('marutisuz')).toEqual(['Maruti Suzuki']);
    expect(matchMakes('  mercedes   benz ')).toEqual(['Mercedes-Benz']);
    expect(matchMakes('HYUNDAI')).toEqual(['Hyundai']);
    expect(matchMakes('maruthisuzuki')).toEqual(['Maruti Suzuki']);
    expect(matchMakes('', 'Old Make')[0]).toBe('Old Make');
  });
});
