import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PhotoStep, planOptions, scaledSize } from '@/features/vehicle/photo-step';
import { VehicleWizard } from '@/features/vehicle/vehicle-wizard';
import { stepAfter, stepBefore, stepOfField } from '@/features/vehicle/vehicle-wizard/utils';
import { submissionBlocker, submissionNeeds } from '@/features/vehicle/vehicle-wizard/submission';

import { VEHICLE_ID, billing, photos, vehicle } from './fixtures';

describe('the Photos step in the wizard', () => {
  it('slots in after Pricing only when the feature is on', () => {
    expect(stepAfter('pricing')).toBe('review');
    expect(stepAfter('pricing', true)).toBe('photos');
    expect(stepBefore('review', true)).toBe('photos');
    expect(stepOfField('photos.FRONT')).toBe('photos');
    expect(stepOfField('photoPlan')).toBe('photos');
  });

  it('shows Photos in the stepper and the step itself when enabled', () => {
    render(<VehicleWizard step="photos" vehicle={vehicle()} photos={photos()} billing={null} />);
    expect(screen.getByText('Photos')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'How will the car be photographed?',
    );
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('falls back to Review for a Photos URL when the feature is off', () => {
    render(<VehicleWizard step="photos" vehicle={vehicle()} photos={photos({ enabled: false })} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Review the details');
  });
});

describe('choosing who photographs the car', () => {
  it('offers the photoshoot only where the district has it, and shows each plan’s credits', () => {
    const options = planOptions(
      photos({ photoshoot: { available: false, district: 'Krishnagiri' } }),
      billing(),
    );
    expect(options.map((option) => [option.plan, option.available, option.credits])).toEqual([
      ['DEALER', true, 1],
      ['DEALERS_DRIVE', false, 2],
    ]);
    expect(options[1]?.note).toBe('Not yet available in Krishnagiri');
  });

  it('shows the ten illustrated shots once the dealer chooses to upload', () => {
    render(
      <PhotoStep
        vehicleId={VEHICLE_ID}
        photos={photos({ plan: 'DEALER' }, 3)}
        billing={null}
        backHref="/back"
        nextHref="/next"
      />,
    );
    expect(screen.getAllByRole('img', { name: /^where to stand for the/i })).toHaveLength(10);
    expect(screen.getByText('3 of 10 photographs')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Replace' })).toHaveLength(3);
  });

  it('explains what happens next for a Dealers-Drive photoshoot, with no uploader', () => {
    render(
      <PhotoStep
        vehicleId={VEHICLE_ID}
        photos={photos({ plan: 'DEALERS_DRIVE', ready: true })}
        billing={null}
        backHref="/back"
        nextHref="/next"
      />,
    );
    expect(screen.getByText('What happens next')).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});

describe('what stands between a car and Submit', () => {
  it('asks for photographs first, then for the credits that are short', () => {
    const none = submissionNeeds(vehicle(), photos(), billing());
    expect(submissionBlocker(none)).toBe('Finish the Photos step to submit.');

    const shortOfCredits = submissionNeeds(
      vehicle(),
      photos({ plan: 'DEALERS_DRIVE', ready: true }),
      billing({ available: 1 }),
    );
    expect(shortOfCredits).toMatchObject({ creditsNeeded: 2, creditsReady: false });
    expect(submissionBlocker(shortOfCredits)).toBe('Buy 1 credit more to submit.');
  });

  it('counts credits a resubmission already holds', () => {
    const held = submissionNeeds(
      vehicle({ status: 'CHANGES_REQUESTED', creditsHeld: 1 }),
      photos({ plan: 'DEALER', ready: true }),
      billing({ available: 0, held: 1, balance: 1 }),
    );
    expect(held).toMatchObject({ creditsNeeded: 0, creditsReady: true });
    expect(submissionBlocker(held)).toBeNull();
  });

  it('asks for nothing while both features are off', () => {
    const off = submissionNeeds(vehicle(), photos({ enabled: false }), billing({ enabled: false }));
    expect(submissionBlocker(off)).toBeNull();
  });

  it('disables Submit and offers to buy credits on the Review step', () => {
    render(
      <VehicleWizard
        step="review"
        vehicle={vehicle()}
        photos={photos({ plan: 'DEALER', ready: true, missing: [] }, 10)}
        billing={billing()}
        packs={{ data: [], gstPercent: 18, taxNote: '', purchasable: true }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Submit for review' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Buy credits' })).toBeInTheDocument();
    expect(screen.getByText('Buy 1 credit more to submit.')).toBeInTheDocument();
  });
});

describe('resizing a large photograph before upload', () => {
  it('keeps the long edge at 4096 and the aspect ratio', () => {
    expect(scaledSize(8000, 6000)).toEqual({ width: 4096, height: 3072 });
    expect(scaledSize(3000, 2000)).toEqual({ width: 3000, height: 2000 });
  });
});
