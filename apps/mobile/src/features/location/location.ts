import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from 'zustand';
import { createLocationStore } from './location-store';

export const locationStore = createLocationStore(AsyncStorage);
export const useDistrict = () => useStore(locationStore, (state) => state.district);
export const useLocationReady = () => useStore(locationStore, (state) => state.hydrated);
