import { Redirect, useLocalSearchParams } from 'expo-router';
import { readVehicleSearch } from '@dealers-drive/contracts/vehicle-search';
export default function ExploreRedirect() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  return <Redirect href={{ pathname: '/cars', params: readVehicleSearch(params) }} />;
}
