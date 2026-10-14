import { Redirect, useLocalSearchParams } from 'expo-router';
import { readVehicleSearch } from '@dealers-drive/contracts/vehicle-search';
export default function CarsLink() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  return <Redirect href={{ pathname: '/(tabs)/explore', params: readVehicleSearch(params) }} />;
}
