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
    color: 'WHITE',
    insuranceType: 'COMPREHENSIVE',
    insuranceValidUntil: '2027-03-31',
    pricePaise: 145_000_000,
    priceLabel: '₹14,50,000',
    negotiability: 'FIXED',
    description: 'One owner.',
    summary: 'Petrol · Automatic · 22,400 km',
    issues: [],
    complete: true,
    listing: {
      id: '33333333-3333-4333-8333-333333333333',
      status: 'DRAFT',
      statusLabel: 'Draft',
      statusTone: 'neutral',
      reason: null,
      submittedAt: null,
      publishedAt: null,
      canEdit: true,
      canSubmit: true,
      canDelete: true,
      slug: null,
      reservedAt: null,
      soldAt: null,
      withdrawnAt: null,
      withdrawal: null,
      actions: [],
    },
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

/**
 * R52 — the colour is chosen from the twelve generic families, the same list
 * the marketplace filters by; a shade name cannot be typed in.
 */
describe('the colour', () => {
  it('is a choice of the twelve families, holding the saved one', () => {
    render(<VehicleWizard step="details" vehicle={vehicle()} />);
    const colour = screen.getByRole('combobox', { name: /colour/i });
    expect(colour.tagName).toBe('SELECT');
    expect(colour).toHaveValue('WHITE');
    expect(
      within(colour)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'Choose…',
      'Black',
      'White',
      'Grey',
      'Silver',
      'Red',
      'Blue',
      'Green',
      'Brown',
      'Beige',
      'Yellow',
      'Orange',
      'Other',
    ]);
  });

  it('shows the family by name on the review step', () => {
    render(<VehicleWizard step="review" vehicle={vehicle({ color: 'SILVER' })} />);
    expect(screen.getByText('Silver')).toBeInTheDocument();
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

describe('what the listing allows (F064)', () => {
  it('shows a vehicle under review read-only, with no form and no edit links', () => {
    const { container } = render(
      <VehicleWizard
        step="basics"
        vehicle={vehicle({
          listing: {
            ...vehicle().listing,
            status: 'PENDING_REVIEW',
            statusLabel: 'Pending review',
            canEdit: false,
            canSubmit: false,
            canDelete: false,
            slug: null,
            reservedAt: null,
            soldAt: null,
            withdrawnAt: null,
            withdrawal: null,
            actions: [],
          },
        })}
      />,
    );

    expect(screen.getByText(/cannot be edited right now/i)).toBeInTheDocument();
    expect(screen.getByText(/with our team for review/i)).toBeInTheDocument();
    expect(container.querySelector('form')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('shows the moderator’s words when changes are requested, and stays editable', () => {
    const { container } = render(
      <VehicleWizard
        step="details"
        vehicle={vehicle({
          listing: {
            ...vehicle().listing,
            status: 'CHANGES_REQUESTED',
            reason: 'The odometer reading does not match the photographs.',
          },
        })}
      />,
    );

    expect(screen.getByText(/asked for changes/i)).toBeInTheDocument();
    expect(
      screen.getByText('The odometer reading does not match the photographs.'),
    ).toBeInTheDocument();
    expect(container.querySelector('form')).not.toBeNull();
  });

  it('shows why a vehicle was not approved', () => {
    render(
      <VehicleWizard
        step="review"
        vehicle={vehicle({
          listing: {
            ...vehicle().listing,
            status: 'REJECTED',
            reason: 'Duplicate of another listing.',
            canEdit: false,
            canDelete: false,
            slug: null,
            reservedAt: null,
            soldAt: null,
            withdrawnAt: null,
            withdrawal: null,
            actions: [],
          },
        })}
      />,
    );
    expect(screen.getByText('Not approved')).toBeInTheDocument();
    expect(screen.getByText('Duplicate of another listing.')).toBeInTheDocument();
  });
});

describe('submitting (F065)', () => {
  it('offers Submit for review on a complete draft', () => {
    render(<VehicleWizard step="review" vehicle={vehicle()} />);
    expect(screen.getByRole('button', { name: 'Submit for review' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Finish later' })).toHaveAttribute('href', '/dealer');
  });

  it('disables it, and says why, until the vehicle is complete', () => {
    render(
      <VehicleWizard
        step="review"
        vehicle={vehicle({
          complete: false,
          issues: [{ field: 'color', message: 'Colour is required.' }],
          listing: { ...vehicle().listing, canSubmit: false },
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Submit for review' })).toBeDisabled();
    expect(screen.getByText(/fill in the missing details/i)).toBeInTheDocument();
  });

  it('calls it a resubmission when changes were requested', () => {
    render(
      <VehicleWizard
        step="review"
        vehicle={vehicle({
          listing: { ...vehicle().listing, status: 'CHANGES_REQUESTED', canDelete: false },
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Resubmit for review' })).toBeEnabled();
  });

  it('confirms a submission, and says who takes the photographs', () => {
    render(
      <VehicleWizard
        step="review"
        submitted
        vehicle={vehicle({
          listing: {
            ...vehicle().listing,
            status: 'PENDING_REVIEW',
            canEdit: false,
            canSubmit: false,
            canDelete: false,
            slug: null,
            reservedAt: null,
            soldAt: null,
            withdrawnAt: null,
            withdrawal: null,
            actions: [],
          },
        })}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Submitted for review' })).toBeInTheDocument();
    expect(screen.getByText(/arrange a photo shoot/i)).toBeInTheDocument();
    expect(screen.getByText('Pending review')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View inventory' })).toHaveAttribute(
      'href',
      '/dealer/inventory',
    );
  });
});
