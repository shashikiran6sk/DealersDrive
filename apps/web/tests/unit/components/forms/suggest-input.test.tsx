import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SuggestInput } from '@/components/forms/suggest-input';

const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('SuggestInput', () => {
  it('offers the values already in use as the dealer types, through the BFF route', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ field: 'make', values: ['Maruti Suzuki', 'Mahindra'] }),
      } as unknown as Response),
    );
    globalThis.fetch = fetchMock;
    const user = userEvent.setup();

    const { container } = render(
      <>
        <label htmlFor="make">Make</label>
        <SuggestInput id="make" field="make" />
      </>,
    );
    await user.type(screen.getByLabelText('Make'), 'Ma');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dealer/vehicles/suggestions?field=make&q=Ma',
      expect.anything(),
    );
    const options = [...container.querySelectorAll('datalist option')].map((option) =>
      option.getAttribute('value'),
    );
    expect(options).toEqual(['Maruti Suzuki', 'Mahindra']);
    expect(screen.getByLabelText('Make')).toHaveAttribute('list', 'make-suggestions');
  });

  it('offers nothing when the lookup fails, and still submits what was typed', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false } as Response));
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <label htmlFor="model">Model</label>
        <SuggestInput id="model" field="model" defaultValue="Cre" />
      </form>,
    );
    await user.type(screen.getByLabelText('Model'), 'ta');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect(container.querySelectorAll('datalist option')).toHaveLength(0);
    expect(screen.getByLabelText('Model')).toHaveValue('Creta');
    expect(screen.getByLabelText('Model')).toHaveAttribute('name', 'model');
  });
});
