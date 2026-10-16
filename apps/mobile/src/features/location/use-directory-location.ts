import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { locationStore } from './location';

export function useDirectoryLocation(district: string | undefined) {
  const router = useRouter();
  const focused = useIsFocused();
  const revision = useStore(locationStore, (state) => state.revision);
  const hydrated = useStore(locationStore, (state) => state.hydrated);
  const sharedDistrict = useStore(locationStore, (state) => state.district);
  const [initialized, setInitialized] = useState(false);
  const seen = useRef({ initialized: false, revision, district });
  useEffect(() => {
    if (!focused || !hydrated) return;
    const current = locationStore.getState();
    if (!seen.current.initialized) {
      setInitialized(true);
      seen.current = { initialized: true, revision: current.revision, district };
      if (district !== undefined && district !== current.district) {
        locationStore.choose(district);
        seen.current.revision = locationStore.getState().revision;
      } else if (district === undefined && current.district) {
        seen.current.district = current.district;
        router.setParams({ district: current.district });
      }
    } else if (current.revision !== seen.current.revision) {
      seen.current = { initialized: true, revision: current.revision, district: current.district };
      router.setParams({
        district: current.district,
        city: undefined,
        dealer: undefined,
        page: undefined,
      });
    } else if (district !== seen.current.district) {
      locationStore.choose(district);
      seen.current = { initialized: true, revision: locationStore.getState().revision, district };
    }
  }, [district, focused, hydrated, revision, router]);
  return hydrated && initialized && district === sharedDistrict;
}
