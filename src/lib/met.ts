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
      const timeoutId = setTimeout(() => {
        console.log(`Request timeout after 10 seconds for ${url}`);
        controller.abort();
      }, 10000); // Increased to 10 second timeout

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
      
      // Don't retry on AbortError - it's likely a timeout or network issue
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`Request aborted, not retrying: ${error.message}`);
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
  // Fallback-only behavior: select exclusively from the generated static list
  if (MET_FALLBACK_GAME_OBJECTS.length > 0) {
    const randomFallback = MET_FALLBACK_GAME_OBJECTS[Math.floor(Math.random() * MET_FALLBACK_GAME_OBJECTS.length)];
    return randomFallback;
  }

  // If no generated fallback data exists, use the ultra-small emergency list
  const randomEmergency = EMERGENCY_FALLBACK_ARTWORKS[Math.floor(Math.random() * EMERGENCY_FALLBACK_ARTWORKS.length)];
  return randomEmergency;
}


