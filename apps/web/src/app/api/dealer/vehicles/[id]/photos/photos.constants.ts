export const PHOTOS_BFF_TEXT = {
  notJson: 'The request body was not JSON.',
  unknownVehicle: 'That vehicle or photograph does not exist.',
  cannotUpload: 'That photograph cannot be uploaded.',
} as const;

export function vehiclePhotosPath(vehicleId: string): string {
  return `/v1/dealer/vehicles/${encodeURIComponent(vehicleId)}`;
}
