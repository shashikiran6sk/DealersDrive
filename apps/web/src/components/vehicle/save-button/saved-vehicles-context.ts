'use client';

import { createContext, useContext } from 'react';

export interface SavedVehiclesContextValue {
  enabled: boolean;
  isSaved: (slug: string) => boolean;
  isPending: (slug: string) => boolean;
  toggle: (slug: string) => void;
}

export const NO_SAVED_VEHICLES: SavedVehiclesContextValue = {
  enabled: false,
  isSaved: () => false,
  isPending: () => false,
  toggle: () => undefined,
};

export const SavedVehiclesContext = createContext<SavedVehiclesContextValue>(NO_SAVED_VEHICLES);

export function useSavedVehicles(): SavedVehiclesContextValue {
  return useContext(SavedVehiclesContext);
}
