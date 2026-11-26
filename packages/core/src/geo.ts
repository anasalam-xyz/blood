export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function estimateTransit(distanceKm: number): {
  etaHours: number;
  etaDays: number;
} {
  // Average road speed 40 km/h in regional network
  const etaHours = Math.max(0.5, Math.round((distanceKm / 40) * 10) / 10);
  const etaDays = Math.ceil(etaHours / 24);
  return { etaHours, etaDays };
}
