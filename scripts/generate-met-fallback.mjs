#!/usr/bin/env node

// Generate a large hard-coded fallback list of GameObject-like entries
// from the Met Collection API and write them to src/data/met-fallback.ts

const fs = await import('fs');
const path = await import('path');

const MET_API_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

// Simple rate limiter: cap at 80 req/s (never exceed Met's limit)
const RATE_LIMIT_RPS = 80;
let availableTokens = RATE_LIMIT_RPS;
const pendingQueue = [];

function drainQueue() {
  while (availableTokens > 0 && pendingQueue.length > 0) {
    const run = pendingQueue.shift();
    availableTokens--;
    run();
  }
}

setInterval(() => {
  availableTokens = RATE_LIMIT_RPS;
  drainQueue();
}, 1000);

function schedule(task) {
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

async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const doFetch = () => fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      const response = await schedule(() => doFetch());
      clearTimeout(timeoutId);
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return response;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

function escapeString(str) {
  return (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/`/g, '\\`')
    .replace(/\r?\n/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '');
}

async function main() {
  const outputPath = path.resolve(process.cwd(), 'src/data/met-fallback.ts');

  // Build a richer set of queries to broaden country coverage
  const baseQueries = ['the','of','and','a','art','sculpture','ceramic','textile','print','metal','wood','glass','bronze','silver','gold','ivory'];
  // We'll also construct geoLocation-based queries below based on centroids

  // Determine current fallback size and target double
  let currentCount = 0;
  try {
    const content = await fs.promises.readFile(outputPath, 'utf8');
    const matches = content.match(/\bobjectId:\s*\d+/g) || [];
    currentCount = matches.length;
  } catch {}

  // If file missing or unparsable, fall back to 500 base
  const baseTarget = currentCount > 0 ? currentCount : 500;
  // Allow CLI arg or env to override, but ensure at least 5000 as requested
  const cliTarget = Number.parseInt(process.argv[2] || '') || 0;
  const envTarget = Number.parseInt(process.env.MET_FALLBACK_TARGET || '') || 0;
  const MIN_TARGET = 5000;
  const desiredCount = Math.max(MIN_TARGET, baseTarget * 2, cliTarget, envTarget);
  const maxIdsPerQuery = 5000;

  const idSet = new Set();

  // Load centroids to derive valid countries for geoLocation searches as well
  const centroidJsonPath = path.resolve(process.cwd(), 'src/data/country-centroids.json');
  const centroidJson = JSON.parse(await fs.promises.readFile(centroidJsonPath, 'utf8'));
  const validCountries = new Set(Object.keys(centroidJson));

  async function collectIds(targetSize) {
    const target = Math.max(targetSize, desiredCount * 12);

    // 1) Broad base queries
    for (const q of baseQueries) {
      try {
        const usePaintings = Math.random() < 0.20;
        const searchUrl = `${MET_API_BASE}/search?hasImages=true&q=${encodeURIComponent(q)}${usePaintings ? '&medium=Paintings' : ''}`;
        const resp = await fetchWithRetry(searchUrl);
        if (!resp.ok) continue;
        const data = await resp.json();
        const ids = data.objectIDs || [];
        for (const id of ids) {
          idSet.add(id);
          if (idSet.size >= target) break;
        }
        if (idSet.size >= target) break;
      } catch {}
    }

    if (idSet.size < target) {
      // 2) GeoLocation-focused searches to ensure country coverage
      const geoCountries = Array.from(validCountries);
      for (let i = geoCountries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [geoCountries[i], geoCountries[j]] = [geoCountries[j], geoCountries[i]];
      }
      for (const country of geoCountries) {
        try {
          const usePaintings = Math.random() < 0.20;
          const searchUrl = `${MET_API_BASE}/search?hasImages=true&q=a&geoLocation=${encodeURIComponent(country)}${usePaintings ? '&medium=Paintings' : ''}`;
          const resp = await fetchWithRetry(searchUrl);
          if (!resp.ok) continue;
          const data = await resp.json();
          const ids = data.objectIDs || [];
          for (const id of ids) {
            idSet.add(id);
            if (idSet.size >= target) break;
          }
          if (idSet.size >= target) break;
        } catch {}
      }
    }

    if (idSet.size < target) {
      // 3) Alphabet tokens to broaden further
      const alpha = 'abcdefghijklmnopqrstuvwxyz'.split('');
      for (const ch of alpha) {
        try {
          const usePaintings = Math.random() < 0.20;
          const searchUrl = `${MET_API_BASE}/search?hasImages=true&q=${ch}${usePaintings ? '&medium=Paintings' : ''}`;
          const resp = await fetchWithRetry(searchUrl);
          if (!resp.ok) continue;
          const data = await resp.json();
          const ids = data.objectIDs || [];
          for (const id of ids) {
            idSet.add(id);
            if (idSet.size >= target) break;
          }
          if (idSet.size >= target) break;
        } catch {}
      }
    }
  }

  await collectIds(desiredCount * 12);

  const allIds = Array.from(idSet);
  for (let i = allIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
  }

  // centroidJson/validCountries already loaded above

  const results = [];
  const perCountryCount = new Map();
  // Soft cap per country to promote diversity (max ~4% per country)
  const maxPerCountry = Math.max(3, Math.ceil(desiredCount * 0.04));

  async function processId(id) {
    if (results.length >= desiredCount) return;
    try {
      const resp = await fetchWithRetry(`${MET_API_BASE}/objects/${id}`);
      if (!resp.ok) return;
      const obj = await resp.json();
      if (!obj || !obj.isPublicDomain) return;
      const imageUrl = obj.primaryImageSmall || obj.primaryImage;
      if (!imageUrl) return;
      const country = (obj.country || '').trim();
      if (!country) return;
      if (!validCountries.has(country)) return;

      // Enforce per-country cap for more even distribution
      const count = perCountryCount.get(country) || 0;
      if (count >= maxPerCountry) return;

      // Keep record
      results.push({
        objectId: obj.objectID,
        imageUrl: imageUrl,
        title: obj.title || 'Untitled',
        artist: obj.artistDisplayName || 'Unknown Artist',
        year: obj.objectDate || 'Unknown Date',
        country,
        locationDescription: country,
        medium: (obj.medium || '').trim() || undefined
      });
      perCountryCount.set(country, count + 1);
    } catch {}
  }

  // Process in batches to avoid scheduling excessive work beyond desiredCount
  const batchSize = 800;
  let index = 0;
  while (results.length < desiredCount && index < allIds.length) {
    const batch = allIds.slice(index, index + batchSize);
    index += batch.length;
    await Promise.allSettled(batch.map(id => processId(id)));
    // If we ran out of IDs and still haven't met desiredCount, collect more
    if (results.length < desiredCount && index >= allIds.length) {
      await collectIds(desiredCount * 16);
      const moreIds = Array.from(idSet);
      for (let i = moreIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [moreIds[i], moreIds[j]] = [moreIds[j], moreIds[i]];
      }
      allIds.length = 0;
      allIds.push(...moreIds);
    }
  }

  // Build file content
  const header = `import { getCountryCentroid } from '@/lib/location';\nimport type { GameObject } from '@/lib/met';\n\n// Auto-generated by scripts/generate-met-fallback.mjs\nexport const MET_FALLBACK_GAME_OBJECTS: GameObject[] = [\n`;

  const lines = results.map(item => {
    const title = escapeString(item.title);
    const artist = escapeString(item.artist);
    const year = escapeString(item.year);
    const country = escapeString(item.country);
    const imageUrl = escapeString(item.imageUrl);
    const medium = item.medium ? `,\n  medium: '${escapeString(item.medium)}'` : '';
    return `  {\n    objectId: ${item.objectId},\n    imageUrl: '${imageUrl}',\n    title: '${title}',\n    artist: '${artist}',\n    year: '${year}',\n    country: '${country}',\n    locationDescription: '${country}',\n    target: getCountryCentroid('${country}')!${medium}\n  }`;
  });

  const footer = `\n];\n`;

  const content = header + lines.join(',\n') + footer;
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, content, 'utf8');
  console.log(`Wrote ${results.length} fallback items to ${outputPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

