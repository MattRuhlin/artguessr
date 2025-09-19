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
const CACHE_SIZE_LIMIT = 100; // Limit cache size to prevent memory issues

// Global rate limiter to ensure we never exceed 80 requests/second to MET API
const RATE_LIMIT_RPS = 80;
let availableTokens = RATE_LIMIT_RPS;
const pendingQueue: Array<() => void> = [];

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

async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

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
      
      // If we get a 502, 503, or 504, retry with exponential backoff
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.log(`API returned ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Request failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries}):`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Max retries exceeded');
}

// ------------------------------
// Dynamic fallback pool builder
// ------------------------------
let fallbackPool: GameObject[] = [];
let fallbackPoolLastBuilt = 0;
let fallbackBuildPromise: Promise<void> | null = null;
const FALLBACK_POOL_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function buildFallbackPool(minSize = 500): Promise<void> {
  const queries = ['a', 'e', 'i', 'o', 'u', 'the', 'of', 'and', 'art', 'painting', 'sculpture', 'ceramic', 'print', 'textile', 'metal'];
  const objectIdSet = new Set<number>();

  for (const q of queries) {
    try {
      const response = await fetchWithRetry(`${MET_API_BASE}/search?hasImages=true&q=${encodeURIComponent(q)}`);
      if (!response.ok) continue;
      const data = await response.json();
      const ids: number[] = data.objectIDs || [];
      for (const id of ids) {
        objectIdSet.add(id);
        if (objectIdSet.size >= minSize * 10) break; // cap to avoid too many
      }
      if (objectIdSet.size >= minSize * 10) break;
    } catch (err) {
      console.warn('Search query failed while building fallback pool:', err);
    }
  }

  const allIds = Array.from(objectIdSet);
  // Shuffle
  for (let i = allIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
  }

  const results: GameObject[] = [];

  for (const objectId of allIds) {
    if (results.length >= minSize) break;
    try {
      const object = await fetchObject(objectId);
      if (!object.isPublicDomain) continue;
      const imageUrl = object.primaryImageSmall || object.primaryImage;
      if (!imageUrl) continue;
      if (!object.country || object.country.trim() === '') continue;

      const target = getCountryCentroid(object.country);
      if (!target) continue;

      results.push({
        objectId: object.objectID,
        imageUrl,
        title: object.title || 'Untitled',
        artist: object.artistDisplayName || 'Unknown Artist',
        year: object.objectDate || 'Unknown Date',
        country: object.country,
        locationDescription: object.country,
        target,
        medium: (object.medium || '').trim() || undefined
      });
    } catch (err) {
      // ignore individual failures
    }
  }

  if (results.length > 0) {
    fallbackPool = results;
    fallbackPoolLastBuilt = Date.now();
    console.log(`Built fallback pool with ${fallbackPool.length} objects`);
  } else {
    console.warn('Failed to build fallback pool; keeping existing pool');
  }
}

async function ensureFallbackPool(): Promise<void> {
  const fresh = (Date.now() - fallbackPoolLastBuilt) < FALLBACK_POOL_TTL && fallbackPool.length > 0;
  if (fresh) return;
  if (!fallbackBuildPromise) {
    fallbackBuildPromise = buildFallbackPool().finally(() => {
      fallbackBuildPromise = null;
    });
  }
  try {
    await fallbackBuildPromise;
  } catch {
    // ignore; will rely on small static fallback
  }
}

export async function fetchObjectIds(): Promise<number[]> {
  const now = Date.now();
  
  if (objectIdsCache && (now - lastFetchTime) < CACHE_DURATION) {
    return objectIdsCache;
  }
  
  try {
    const response = await fetchWithRetry(`${MET_API_BASE}/search?hasImages=true&q=a`);
    
    if (!response.ok) {
      console.log('Response object:', response);
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
    const response = await fetchWithRetry(`${MET_API_BASE}/objects/${objectId}`);
    
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
    // Build or refresh fallback pool in the background (non-blocking)
    ensureFallbackPool().catch(() => {});

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
          target: target,
          medium: (object.medium || '').trim() || undefined
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
    
    // If the API is unavailable or no valid objects found, use large static generated list first
    try {
      if (MET_FALLBACK_GAME_OBJECTS.length > 0) {
        const randomFallback = MET_FALLBACK_GAME_OBJECTS[Math.floor(Math.random() * MET_FALLBACK_GAME_OBJECTS.length)];
        console.log(`Using dynamic fallback artwork: ${randomFallback.title}`);
        return randomFallback;
      }
    } catch {}

    // Then try dynamic pool if available
    try {
      await ensureFallbackPool();
      if (fallbackPool.length > 0) {
        const randomFallback = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
        console.log(`Using dynamic fallback artwork: ${randomFallback.title}`);
        return randomFallback;
      }
    } catch {}

    // As a last resort, use ultra-tiny emergency list
    console.log('Fallback pools unavailable, using emergency static fallback artworks');
    const randomFallback = EMERGENCY_FALLBACK_ARTWORKS[Math.floor(Math.random() * EMERGENCY_FALLBACK_ARTWORKS.length)];
    console.log(`Using fallback artwork: ${randomFallback.title}`);
    return randomFallback;
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

