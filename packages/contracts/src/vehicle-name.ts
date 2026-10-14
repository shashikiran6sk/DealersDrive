export function titleWithoutYear(vehicle: { title: string; year: number | null }): string {
  if (vehicle.year === null) return vehicle.title;
  const prefix = `${String(vehicle.year)} `;
  const rest = vehicle.title.startsWith(prefix) ? vehicle.title.slice(prefix.length).trim() : '';
  return rest || vehicle.title;
}
