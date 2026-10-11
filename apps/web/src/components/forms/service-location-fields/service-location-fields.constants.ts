export const SERVICE_LOCATION_TEXT = {
  stateLabel: 'State',
  districtLabel: 'District',
  loadingStates: 'Loading service locations…',
  selectState: 'Select state',
  existingState: (state: string) => `${state} (existing location)`,
  searchDistricts: 'Search districts',
  districtsListLabel: 'Districts',
  noDistricts: 'No available districts match.',
  loadFailed: 'Service locations could not be loaded. Reload this page to try again.',
} as const;
