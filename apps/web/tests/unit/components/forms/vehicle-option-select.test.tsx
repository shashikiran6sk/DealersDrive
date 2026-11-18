import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VehicleOptionSelect } from '@/components/forms/vehicle-option-select';
import { IdentityFields } from '@/features/vehicle/vehicle-wizard/identity-fields';

const ORIGINAL_FETCH = globalThis.fetch;

const CATALOGUE: Record<string, string[]> = {
  'model|Hyundai|': ['Creta', 'i20', 'Venue'],
  'model|Tata|': ['Nexon', 'Punch'],
  'variant|Hyundai|Creta': ['SX(O)', 'S', 'E'],
  'variant|Hyundai|Venue': ['S Plus'],
};

function serve(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: string) => {
    const params = new URL(input, 'http://x').searchParams;
    const key = `${params.get('field')}|${params.get('make')}|${params.get('model') ?? ''}`;
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ field: params.get('field'), values: CATALOGUE[key] ?? [] }),
    } as unknown as Response);
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function posted(container: HTMLElement, name: string): string | null {
  const input = container.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);
  return input ? input.value : null;
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('VehicleOptionSelect', () => {
  it('lists the models already in use under the make as soon as it is focused', async () => {
    const fetchMock = serve();
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="model">Model</label>
        <VehicleOptionSelect id="model" field="model" make="Hyundai" />
      </>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dealer/vehicles/suggestions?field=model&make=Hyundai',
      expect.anything(),
    );

    await user.click(screen.getByLabelText('Model'));
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['Creta', 'i20', 'Venue']);
    expect(screen.getByText('Not listed? Type the model name.')).toBeInTheDocument();
  });

  it('filters as the dealer types and offers an unlisted model as a new one', async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(
      <>
        <label htmlFor="model">Model</label>
        <VehicleOptionSelect id="model" field="model" make="Hyundai" />
      </>,
    );
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await user.type(screen.getByLabelText('Model'), 'Alcazar');

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Add “Alcazar” as a new model',
    ]);
    await user.click(screen.getByText('Add “Alcazar” as a new model'));
    expect(posted(container, 'model')).toBe('Alcazar');
  });

  it('adopts the listed spelling for another spelling of the same model', async () => {
    serve();
    const user = userEvent.setup();
    const { container } = render(
      <>
        <label htmlFor="model">Model</label>
        <VehicleOptionSelect id="model" field="model" make="Hyundai" />
      </>,
    );
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await user.type(screen.getByLabelText('Model'), 'I-20');

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['i20']);
    await user.tab();
    expect(screen.getByLabelText('Model')).toHaveValue('i20');
    expect(posted(container, 'model')).toBe('i20');
  });

  it('waits for its parent before asking for anything', () => {
    const fetchMock = serve();
    render(
      <>
        <label htmlFor="variant">Variant</label>
        <VehicleOptionSelect id="variant" field="variant" make="Hyundai" />
      </>,
    );
    expect(screen.getByLabelText('Variant')).toBeDisabled();
    expect(screen.getByLabelText('Variant')).toHaveAttribute(
      'placeholder',
      'Choose the model first',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still takes a typed value when the list cannot be loaded', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false } as Response));
    const user = userEvent.setup();
    const { container } = render(
      <>
        <label htmlFor="model">Model</label>
        <VehicleOptionSelect id="model" field="model" make="Hyundai" />
      </>,
    );
    await user.click(screen.getByLabelText('Model'));
    await screen.findByText('Could not load the list. Type the model as on the RC.');
    await user.type(screen.getByLabelText('Model'), 'Creta');
    await user.tab();
    expect(posted(container, 'model')).toBe('Creta');
  });
});

describe('IdentityFields', () => {
  it('scopes models to the make and variants to the model, and resets them when a parent changes', async () => {
    const fetchMock = serve();
    const user = userEvent.setup();
    const { container } = render(
      <IdentityFields
        errors={{}}
        initial={{ make: 'Hyundai', model: 'Creta', variant: 'SX(O)' }}
      />,
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/dealer/vehicles/suggestions?field=variant&make=Hyundai&model=Creta',
        expect.anything(),
      ),
    );
    expect(posted(container, 'model')).toBe('Creta');
    expect(posted(container, 'variant')).toBe('SX(O)');

    await user.click(screen.getByLabelText(/^Variant/));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'SX(O)',
      'S',
      'E',
    ]);
    await user.keyboard('{Escape}');

    const make = screen.getByRole('combobox', { name: /^Make/ });
    await user.clear(make);
    await user.type(make, 'Tata');
    await user.keyboard('{Enter}');

    expect(posted(container, 'make')).toBe('Tata');
    expect(posted(container, 'model')).toBe('');
    expect(posted(container, 'variant')).toBe('');
    expect(screen.getByLabelText(/^Variant/)).toBeDisabled();

    await user.click(screen.getByLabelText(/^Model/));
    await waitFor(() =>
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Nexon',
        'Punch',
      ]),
    );
  });
});
