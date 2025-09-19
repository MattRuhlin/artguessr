import { getCountryCentroid, LatLng } from './location';
import { MET_FALLBACK_GAME_OBJECTS } from '@/data/met-fallback';

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
  medium?: string;
}

// In-memory cache for object IDs
let objectIdsCache: number[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Cache for successful game objects to avoid re-fetching
const gameObjectCache = new Map<number, GameObject>();

// Global rate limiter to ensure we never exceed 50 requests/second to MET API
const RATE_LIMIT_RPS = 50;
let availableTokens = RATE_LIMIT_RPS;
const pendingQueue: Array<() => void> = [];

// Circuit breaker to avoid repeated API failures
let apiFailureCount = 0;
let lastApiFailureTime = 0;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_TIMEOUT = 5 * 60 * 1000; // 5 minutes

function isCircuitBreakerOpen(): boolean {
  const now = Date.now();
  if (now - lastApiFailureTime > CIRCUIT_BREAKER_TIMEOUT) {
    apiFailureCount = 0; // Reset after timeout
    return false;
  }
  return apiFailureCount >= CIRCUIT_BREAKER_THRESHOLD;
}

function recordApiFailure(): void {
  apiFailureCount++;
  lastApiFailureTime = Date.now();
}

function recordApiSuccess(): void {
  apiFailureCount = 0;
}

function drainQueue() {
  while (availableTokens > 0 && pendingQueue.length > 0) {
    const run = pendingQueue.shift()!;
    availableTokens--;
    run();
  }
}

setInterval(() => {
  availableTokens = RATE_LIMIT_RPS;
  drainQueue();
}, 1000);

function scheduleRateLimited<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      Promise.resolve()
        .then(task)
        .then(resolve)
        .catch(reject);
    };
    if (availableTokens > 0) {
      availableTokens--;
      run();
    } else {
      pendingQueue.push(run);
    }
  });
}

// Legacy tiny static fallback removed in favor of larger generated fallback list.
// We still keep an ultra-tiny emergency list below as a last resort.
const EMERGENCY_FALLBACK_ARTWORKS: GameObject[] = [
  {
    objectId: 1001,
    imageUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DT1567.jpg',
    title: 'The Starry Night',
    artist: 'Vincent van Gogh',
    year: '1889',
    country: 'Netherlands',
    locationDescription: 'Netherlands',
    target: getCountryCentroid('Netherlands')!
  }
];

async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 2): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced to 5 second timeout

      const doFetch = () => fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'ArtGuessr/1.0 (Educational Game)',
          'Accept': 'application/json',
          ...options.headers
        }
      });

      const response = url.startsWith(MET_API_BASE)
        ? await scheduleRateLimited(() => doFetch())
        : await doFetch();

      clearTimeout(timeoutId);
      
      // If we get a 502, 503, or 504, retry with shorter backoff
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = attempt * 1000; // Linear backoff: 1s, 2s
        console.log(`API returned ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = attempt * 1000; // Linear backoff: 1s, 2s
      console.log(`Request failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries}):`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Max retries exceeded');
}


export async function fetchObjectIds(): Promise<number[]> {
  const now = Date.now();
  
  if (objectIdsCache && (now - lastFetchTime) < CACHE_DURATION) {
    return objectIdsCache;
  }
  
  // Check circuit breaker
  if (isCircuitBreakerOpen()) {
    console.log('Circuit breaker is open, skipping API call');
    throw new Error('API circuit breaker is open');
  }
  
  try {
    const response = await fetchWithRetry(`${MET_API_BASE}/search?hasImages=true&q=a`);
    
    if (!response.ok) {
      console.log('Response object:', response);
      recordApiFailure();
      throw new Error(`Failed to fetch object IDs: ${response.status}`);
    }
    
    const data = await response.json();
    objectIdsCache = data.objectIDs || [];
    lastFetchTime = now;
    recordApiSuccess();
    
    return objectIdsCache || [];
  } catch (error) {
    console.error('Error fetching object IDs:', error);
    recordApiFailure();
    throw new Error('Failed to fetch object IDs from Met Museum API');
  }
}

export async function fetchObject(objectId: number): Promise<MetObject> {
  // Check circuit breaker
  if (isCircuitBreakerOpen()) {
    console.log('Circuit breaker is open, skipping API call');
    throw new Error('API circuit breaker is open');
  }
  
  try {
    const response = await fetchWithRetry(`${MET_API_BASE}/objects/${objectId}`);
    
    if (!response.ok) {
      recordApiFailure();
      throw new Error(`Failed to fetch object ${objectId}: ${response.status}`);
    }
    
    const data = await response.json();
    recordApiSuccess();
    return data;
  } catch (error) {
    console.error(`Error fetching object ${objectId}:`, error);
    recordApiFailure();
    throw new Error(`Failed to fetch object ${objectId} from Met Museum API`);
  }
}

export async function getRandomGameObject(): Promise<GameObject> {
  console.log('Starting getRandomGameObject...');
  
  // First, try to get a random object from the static fallback for instant response
  if (MET_FALLBACK_GAME_OBJECTS.length > 0) {
    const randomFallback = MET_FALLBACK_GAME_OBJECTS[Math.floor(Math.random() * MET_FALLBACK_GAME_OBJECTS.length)];
    console.log(`Using static fallback artwork for instant response: ${randomFallback.title}`);
    
    // Start background API refresh if circuit breaker is not open
    if (!isCircuitBreakerOpen()) {
      console.log('Starting background API refresh...');
      refreshFromApiInBackground().catch(error => {
        console.log('Background API refresh failed:', error);
      });
    }
    
    return randomFallback;
  }
  
  // If no fallback data, try API with fast failure
  try {
    console.log('No fallback data available, trying API...');
    const objectIds = await fetchObjectIds();
    const maxAttempts = 5; // Reduced attempts
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const randomIndex = Math.floor(Math.random() * objectIds.length);
        const objectId = objectIds[randomIndex];
        
        console.log(`Attempt ${attempt + 1}: Trying object ID: ${objectId}`);
        
        if (gameObjectCache.has(objectId)) {
          const cachedObject = gameObjectCache.get(objectId)!;
          console.log(`Using cached object: ${cachedObject.title}`);
          return cachedObject;
        }
        
        const object = await fetchObject(objectId);
        console.log(`Fetched object: ${object.title}, public domain: ${object.isPublicDomain}, country: "${object.country}"`);
        
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
          locationDescription: object.country,
          target: target,
          medium: (object.medium || '').trim() || undefined
        };
        
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
    
    // Emergency fallback
    console.log('Using emergency fallback artworks');
    const randomFallback = EMERGENCY_FALLBACK_ARTWORKS[Math.floor(Math.random() * EMERGENCY_FALLBACK_ARTWORKS.length)];
    console.log(`Using emergency fallback artwork: ${randomFallback.title}`);
    return randomFallback;
  }
}

// Background function to refresh data from API without blocking the response
async function refreshFromApiInBackground(): Promise<void> {
  try {
    console.log('Background: Fetching fresh object IDs...');
    const objectIds = await fetchObjectIds();
    
    // Cache a few random objects for future use
    const numToCache = Math.min(5, objectIds.length);
    for (let i = 0; i < numToCache; i++) {
      try {
        const randomIndex = Math.floor(Math.random() * objectIds.length);
        const objectId = objectIds[randomIndex];
        
        if (!gameObjectCache.has(objectId)) {
          const object = await fetchObject(objectId);
          
          if (object.isPublicDomain && (object.primaryImageSmall || object.primaryImage) && object.country) {
            const target = getCountryCentroid(object.country);
            if (target) {
              const gameObject = {
                objectId: object.objectID,
                imageUrl: object.primaryImageSmall || object.primaryImage,
                title: object.title || 'Untitled',
                artist: object.artistDisplayName || 'Unknown Artist',
                year: object.objectDate || 'Unknown Date',
                country: object.country,
                locationDescription: object.country,
                target: target,
                medium: (object.medium || '').trim() || undefined
              };
              
              gameObjectCache.set(objectId, gameObject);
              console.log(`Background: Cached object ${gameObject.title}`);
            }
          }
        }
      } catch (error) {
        console.log(`Background: Failed to cache object ${i + 1}:`, error);
      }
    }
    
    console.log('Background: API refresh completed');
  } catch (error) {
    console.log('Background: API refresh failed:', error);
  }
}


