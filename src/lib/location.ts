import { countryCentroids } from '@/data/country-centroids';

export interface LatLng {
  lat: number;
  lng: number;
}

export function getCountryCentroid(country: string): LatLng | null {
  const normalizedCountry = country.trim();
  
  // Direct lookup
  if (countryCentroids[normalizedCountry]) {
    return countryCentroids[normalizedCountry];
  }
  
  // Try some common variations
  const variations = [
    normalizedCountry,
    normalizedCountry.toLowerCase(),
    normalizedCountry.toUpperCase(),
    // Handle common country name variations
    normalizedCountry.replace('United States', 'United States'),
    normalizedCountry.replace('USA', 'United States'),
    normalizedCountry.replace('UK', 'United Kingdom'),
    normalizedCountry.replace('U.K.', 'United Kingdom'),
    // Handle historical regions
    normalizedCountry.replace('Byzantine Egypt', 'Egypt'),
    normalizedCountry.replace('Ancient Egypt', 'Egypt'),
    normalizedCountry.replace('Roman Egypt', 'Egypt'),
    normalizedCountry.replace('Byzantine Empire', 'Turkey'),
    normalizedCountry.replace('Ancient Greece', 'Greece'),
    normalizedCountry.replace('Ancient Rome', 'Italy'),
    normalizedCountry.replace('Medieval Europe', 'France'),
    normalizedCountry.replace('Renaissance Italy', 'Italy'),
    normalizedCountry.replace('Colonial America', 'United States'),
    normalizedCountry.replace('British Empire', 'United Kingdom'),
  ];
  
  for (const variation of variations) {
    if (countryCentroids[variation]) {
      return countryCentroids[variation];
    }
  }
  
  return null;
}

// Cache for reverse geocoding results
const reverseGeocodeCache = new Map<string, string | null>();

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  
  // Check cache first
  if (reverseGeocodeCache.has(cacheKey)) {
    return reverseGeocodeCache.get(cacheKey) || null;
  }
  
  try {
    // Use Nominatim reverse geocoding to get country
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=3&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'ArtGuessr/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.status}`);
    }
    
    const data = await response.json();
    const country = data.address?.country;
    
    // Cache the result
    reverseGeocodeCache.set(cacheKey, country || null);
    return country || null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    reverseGeocodeCache.set(cacheKey, null);
    return null;
  }
}

