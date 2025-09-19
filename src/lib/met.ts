import { getCountryCentroid, LatLng } from './location';

const MET_API_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

export interface MetObject {
  objectID: number;
  isHighlight: boolean;
  isPublicDomain: boolean;
  primaryImage: string;
  primaryImageSmall: string;
  title: string;
  artistDisplayName: string;
  objectDate: string;
  country: string;
  culture: string;
  department: string;
  medium: string;
  dimensions: string;
  objectURL: string;
}

export interface GameObject {
  objectId: number;
  imageUrl: string;
  title: string;
  artist: string;
  year: string;
  country: string;
  locationDescription: string; // Human-readable location (e.g., "France" or "United States")
  target: LatLng;
}

// In-memory cache for object IDs
let objectIdsCache: number[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Cache for successful game objects to avoid re-fetching
const gameObjectCache = new Map<number, GameObject>();
const CACHE_SIZE_LIMIT = 100; // Limit cache size to prevent memory issues

export async function fetchObjectIds(): Promise<number[]> {
  const now = Date.now();
  
  if (objectIdsCache && (now - lastFetchTime) < CACHE_DURATION) {
    return objectIdsCache;
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch(`${MET_API_BASE}/objects`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch object IDs: ${response.status}`);
    }
    
    const data = await response.json();
    objectIdsCache = data.objectIDs || [];
    lastFetchTime = now;
    
    return objectIdsCache || [];
  } catch (error) {
    console.error('Error fetching object IDs:', error);
    throw new Error('Failed to fetch object IDs from Met Museum API');
  }
}

export async function fetchObject(objectId: number): Promise<MetObject> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${MET_API_BASE}/objects/${objectId}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch object ${objectId}: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching object ${objectId}:`, error);
    throw new Error(`Failed to fetch object ${objectId} from Met Museum API`);
  }
}

export async function getRandomGameObject(): Promise<GameObject> {
  console.log('Starting getRandomGameObject...');
  
  try {
    // Get random object IDs from the API
    const objectIds = await fetchObjectIds();
    const maxAttempts = 10;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Pick a random object ID
        const randomIndex = Math.floor(Math.random() * objectIds.length);
        const objectId = objectIds[randomIndex];
        
        console.log(`Attempt ${attempt + 1}: Trying object ID: ${objectId}`);
        
        // Check if we already have this object cached
        if (gameObjectCache.has(objectId)) {
          const cachedObject = gameObjectCache.get(objectId)!;
          console.log(`Using cached object: ${cachedObject.title}`);
          return cachedObject;
        }
        
        // Fetch the object details
        const object = await fetchObject(objectId);
        console.log(`Fetched object: ${object.title}, public domain: ${object.isPublicDomain}, country: "${object.country}"`);
        
        // Basic validation - only require public domain, image, and country
        if (!object.isPublicDomain) {
          console.log('Skipping: not public domain');
          continue;
        }
        
        const imageUrl = object.primaryImageSmall || object.primaryImage;
        if (!imageUrl) {
          console.log('Skipping: no image');
          continue;
        }
        
        if (!object.country || object.country.trim() === '') {
          console.log('Skipping: no country');
          continue;
        }
        
        // Always use country centroid - no complex geocoding
        const target = getCountryCentroid(object.country);
        if (!target) {
          console.log(`Skipping: no country centroid for "${object.country}"`);
          continue;
        }
        
        console.log(`Using country centroid for "${object.country}":`, target);
        
        const gameObject = {
          objectId: object.objectID,
          imageUrl,
          title: object.title || 'Untitled',
          artist: object.artistDisplayName || 'Unknown Artist',
          year: object.objectDate || 'Unknown Date',
          country: object.country,
          locationDescription: object.country, // Just show the country
          target: target
        };
        
        // Cache the successful object
        gameObjectCache.set(objectId, gameObject);
        
        console.log(`Successfully created game object: ${gameObject.title} from ${gameObject.country}`);
        return gameObject;
      } catch (error) {
        console.log(`Object attempt ${attempt + 1} failed:`, error);
        continue;
      }
    }
    
    throw new Error('No valid objects found after multiple attempts');
  } catch (error) {
    console.error('Error in getRandomGameObject:', error);
    throw error;
  }
}

// Function to preload the next artwork
export async function preloadNextGameObject(): Promise<GameObject | null> {
  try {
    return await getRandomGameObject();
  } catch (error) {
    console.error('Error preloading next object:', error);
    return null;
  }
}

