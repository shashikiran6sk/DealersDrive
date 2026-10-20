import { useStore } from 'zustand';
import { deviceStorage } from './device-storage';
import { createLocationStore } from './location-store';

export const locationStore = createLocationStore(deviceStorage);
export const useDistrict = () => useStore(locationStore, (state) => state.district);
export const useLocationReady = () => useStore(locationStore, (state) => state.hydrated);
