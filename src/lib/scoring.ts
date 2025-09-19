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
  // Moderately lenient scoring:
  // - Maximum distance for any points: 10,000km
  // - Linear decay from 5000 points at 0km to 0 points at 10,000km
  const maxDistance = 10000;
  const maxScore = 5000;
  
  if (distanceKm >= maxDistance) return 0;
  
  const s = 1 - distanceKm / maxDistance;
  const score = maxScore * s;
  return Math.round(score);
}

