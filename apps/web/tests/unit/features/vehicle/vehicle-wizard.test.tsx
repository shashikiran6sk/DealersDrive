import type { DealerVehicle } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VehicleWizard, WIZARD_STEPS } from '@/features/vehicle/vehicle-wizard';

const ID = '22222222-2222-4222-8222-222222222222';

function vehicle(overrides: Partial<DealerVehicle> = {}): DealerVehicle {
  return {
    id: ID,
    title: '2023 Hyundai Creta SX(O)',
    registrationNumber: 'KA01AB1234',
    registrationDisplay: 'KA 01 AB 1234',
    rtoCode: 'KA01',
    make: 'Hyundai',
    model: 'Creta',
    variant: 'SX(O)',
    manufacturingYear: 2023,
    registrationYear: 2023,
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    bodyType: 'SUV',
    kilometersDriven: 22_400,
    ownerCount: 1,
    color: 'Polar White',
    insuranceType: 'COMPREHENSIVE',
    insuranceValidUntil: '2027-03-31',
    pricePaise: 145_000_000,
    priceLabel: '₹14,50,000',
    negotiability: 'FIXED',
    description: 'One owner.',
    summary: 'Petrol · Automatic · 22,400 km',
    issues: [],
    complete: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('the steps', () => {
  it('has five data steps and no Photos step (R45)', () => {
    expect(WIZARD_STEPS).toEqual(['registration', 'basics', 'details', 'pricing', 'review']);

    render(<VehicleWizard step="registration" vehicle={null} />);
    expect(screen.queryByText(/photo/i)).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});

describe('starting a vehicle', () => {
  it('asks for the plate, with Cancel and Continue and nothing to go back to', () => {
    render(<VehicleWizard step="registration" vehicle={null} />);

    expect(screen.getByRole('textbox', { name: /registration number/i })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/dealer');
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveAttribute('value', 'continue');
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
  });
});

describe('a saved vehicle', () => {
  it('fills the step from what was saved and names the vehicle and step it posts', () => {
    const { container } = render(<VehicleWizard step="basics" vehicle={vehicle()} />);

    expect(screen.getByLabelText(/make/i)).toHaveValue('Hyundai');
    expect(screen.getByLabelText(/fuel/i)).toHaveValue('PETROL');
    expect(container.querySelector('input[name="vehicleId"]')).toHaveValue(ID);
    expect(container.querySelector('input[name="step"]')).toHaveValue('basics');
  });

  it('offers Back, Save draft and Continue as three intents of one form', () => {
    render(<VehicleWizard step="details" vehicle={vehicle()} />);

    expect(screen.getByRole('button', { name: 'Back' })).toHaveAttribute('value', 'back');
    expect(screen.getByRole('button', { name: 'Save draft' })).toHaveAttribute('value', 'draft');
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveAttribute('value', 'continue');
  });

  it('shows the price in rupees, grouped the Indian way', () => {
    const { container } = render(<VehicleWizard step="pricing" vehicle={vehicle()} />);
    expect(container.querySelector('#priceRupees')).toHaveValue('14,50,000');
  });

  it('confirms a saved draft', () => {
    render(<VehicleWizard step="details" vehicle={vehicle()} saved />);
    expect(screen.getByText(/draft saved/i)).toBeInTheDocument();
  });
});

describe('the review step', () => {
  it('says a complete vehicle is ready and links each section back to its step', () => {
    render(<VehicleWizard step="review" vehicle={vehicle()} />);

    expect(screen.getByText(/everything needed for review/i)).toBeInTheDocument();
    const edits = screen
      .getAllByRole('link', { name: 'Edit' })
      .map((link) => link.getAttribute('href'));
    expect(edits).toEqual(
      ['registration', 'basics', 'details', 'pricing'].map(
        (step) => `/dealer/vehicles/${ID}/edit?step=${step}`,
      ),
    );
    expect(screen.getByText('₹14,50,000', { selector: 'dd' })).toBeInTheDocument();
  });

  it('lists what is missing, each with a link to the step that fixes it', () => {
    render(
      <VehicleWizard
        step="review"
        vehicle={vehicle({
          complete: false,
          pricePaise: null,
          priceLabel: null,
          issues: [
            { field: 'pricePaise', message: 'Price is required.' },
            {
              field: 'insuranceValidUntil',
              message: 'Enter the date the insurance is valid until.',
            },
          ],
        })}
      />,
    );

    const missing = screen.getByText(/still missing/i).closest('[role="status"]');
    if (!(missing instanceof HTMLElement)) throw new Error('no banner');
    const fixes = within(missing)
      .getAllByRole('link', { name: 'Fix' })
      .map((link) => link.getAttribute('href'));
    expect(fixes).toEqual([
      `/dealer/vehicles/${ID}/edit?step=pricing`,
      `/dealer/vehicles/${ID}/edit?step=details`,
    ]);
  });

  it('tells the dealer that Dealers-Drive takes the photographs', () => {
    render(<VehicleWizard step="review" vehicle={vehicle()} />);
    expect(screen.getByText(/dealers-drive arranges a shoot/i)).toBeInTheDocument();
  });
});
