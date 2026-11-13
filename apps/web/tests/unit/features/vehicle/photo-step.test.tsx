import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PhotoStep, planOptions, scaledSize } from '@/features/vehicle/photo-step';
import { VehicleWizard } from '@/features/vehicle/vehicle-wizard';
import { stepAfter, stepBefore, stepOfField } from '@/features/vehicle/vehicle-wizard/utils';
import { submissionBlocker, submissionNeeds } from '@/features/vehicle/vehicle-wizard/submission';

import { VEHICLE_ID, photos, vehicle } from './fixtures';

describe('the Photos step in the wizard', () => {
  it('slots in after Pricing only when the feature is on', () => {
    expect(stepAfter('pricing')).toBe('review');
    expect(stepAfter('pricing', true)).toBe('photos');
    expect(stepBefore('review', true)).toBe('photos');
    expect(stepOfField('photos.FRONT')).toBe('photos');
    expect(stepOfField('photoPlan')).toBe('photos');
  });

  it('shows Photos in the stepper and the step itself when enabled', () => {
    render(<VehicleWizard step="photos" vehicle={vehicle()} photos={photos()} />);
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
  it('offers the photoshoot only where the district has it', () => {
    const options = planOptions(
      photos({ photoshoot: { available: false, district: 'Krishnagiri' } }),
    );
    expect(options.map((option) => [option.plan, option.available])).toEqual([
      ['DEALER', true],
      ['DEALERS_DRIVE', false],
    ]);
    expect(options[1]?.note).toBe('Not yet available in Krishnagiri');
  });

  it('shows the ten illustrated shots once the dealer chooses to upload', () => {
    render(
      <PhotoStep
        vehicleId={VEHICLE_ID}
        photos={photos({ plan: 'DEALER' }, 3)}
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
        backHref="/back"
        nextHref="/next"
      />,
    );
    expect(screen.getByText('What happens next')).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});

describe('what stands between a car and Submit', () => {
  it('asks for the photographs until they are ready', () => {
    expect(submissionBlocker(submissionNeeds(photos()))).toBe('Finish the Photos step to submit.');
    expect(submissionBlocker(submissionNeeds(photos({ plan: 'DEALER', ready: true })))).toBeNull();
  });

  it('asks for nothing while the feature is off', () => {
    expect(submissionBlocker(submissionNeeds(photos({ enabled: false })))).toBeNull();
    expect(submissionBlocker(submissionNeeds(null))).toBeNull();
  });

  it('disables Submit on the Review step until the photographs are in', () => {
    render(
      <VehicleWizard step="review" vehicle={vehicle()} photos={photos({ plan: 'DEALER' }, 6)} />,
    );
    expect(screen.getByRole('button', { name: 'Submit for review' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Go to Photos' })).toBeInTheDocument();
  });
});

describe('resizing a large photograph before upload', () => {
  it('keeps the long edge at 4096 and the aspect ratio', () => {
    expect(scaledSize(8000, 6000)).toEqual({ width: 4096, height: 3072 });
    expect(scaledSize(3000, 2000)).toEqual({ width: 3000, height: 2000 });
  });
});
