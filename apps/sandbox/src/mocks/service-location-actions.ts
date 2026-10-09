import type { ServiceLocationsResponse } from '@dealers-drive/contracts';

export function loadServiceLocationsAction(): Promise<ServiceLocationsResponse> {
  return Promise.resolve({
    data: [
      {
        id: 'IN-TN',
        name: 'Tamil Nadu',
        kind: 'STATE',
        active: true,
        onboardingEnabled: true,
        version: 1,
        districts: ['Vellore', 'Chennai', 'Ranipet'].map((name) => ({
          id: `IN-TN-${name.toUpperCase()}`,
          stateId: 'IN-TN',
          name,
          sourceUrl: 'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',
          active: true,
          onboardingEnabled: true,
          photographyAvailable: true,
          version: 1,
        })),
      },
    ],
  });
}
