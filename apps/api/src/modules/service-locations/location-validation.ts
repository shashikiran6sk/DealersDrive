import type { Tx } from '../../platform/db/prisma.js';
import { DomainError } from '../../platform/errors.js';

export async function resolveOnboardingLocation(
  tx: Tx,
  state: string,
  district: string,
  fieldPrefix = 'body',
) {
  const stateKey = state.trim().replace(/\s+/g, ' ').toLowerCase();
  const districtKey = district.trim().replace(/\s+/g, ' ').toLowerCase();
  const states = await tx.$queryRaw<{ id: string; name: string }[]>`
    SELECT "id", "name" FROM "service_states"
    WHERE ${stateKey} = ANY("aliases") AND "active" AND "onboardingEnabled" FOR SHARE`;
  const selectedState = states[0];
  if (states.length !== 1 || !selectedState) {
    throw new DomainError('LOCATION_UNAVAILABLE', 'Select a state available for new onboarding.', {
      errors: [
        {
          field: `${fieldPrefix}.state`,
          code: 'LOCATION_UNAVAILABLE',
          message: 'This state is not available for new onboarding.',
        },
      ],
    });
  }
  const districts = await tx.$queryRaw<{ id: string; name: string }[]>`
    SELECT "id", "name" FROM "service_districts"
    WHERE "stateId" = ${selectedState.id} AND ${districtKey} = ANY("aliases")
    AND "active" AND "onboardingEnabled" FOR SHARE`;
  const selectedDistrict = districts[0];
  if (districts.length !== 1 || !selectedDistrict) {
    throw new DomainError(
      'LOCATION_UNAVAILABLE',
      'Select an available district within your state.',
      {
        errors: [
          {
            field: `${fieldPrefix}.district`,
            code: 'LOCATION_UNAVAILABLE',
            message: 'This district is not available in the selected state.',
          },
        ],
      },
    );
  }
  return {
    state: selectedState.name,
    district: selectedDistrict.name,
    serviceStateId: selectedState.id,
    serviceDistrictId: selectedDistrict.id,
    locationReviewRequired: false,
  };
}
