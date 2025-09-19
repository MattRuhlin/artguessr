export interface LatLng {
  lat: number;
  lng: number;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function roundScore(distanceKm: number): number {
  // More strict scoring with steeper penalty in middle range:
  // - Maximum distance for any points: 10,000km
  // - Non-linear decay that's stricter in the middle range (2000-6000km)
  const maxDistance = 10000;
  const maxScore = 5000;
  
  if (distanceKm >= maxDistance) return 0;
  
  // Use a quadratic function that's steeper in the middle range
  // This makes the scoring more strict for distances between 2000-6000km
  const normalizedDistance = distanceKm / maxDistance;
  const s = Math.pow(1 - normalizedDistance, 1.5); // 1.5 exponent makes it steeper
  const score = maxScore * s;
  return Math.round(score);
}

