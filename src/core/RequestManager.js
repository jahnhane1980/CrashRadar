import ky from 'ky';
import { Logger } from './Logger.js';

const STAGED_BACKOFF_DELAYS = [5000, 15000, 30000];
const MAX_CACHE_ENTRIES = 500;
const DEFAULT_CACHE_TTL = 300000;

export function parseRetryAfter(headerValue) {
  if (!headerValue) return null;
  const seconds = Number(headerValue);
  if (!Number.isNaN(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return null;
}

export class RequestManager {
  constructor(config) {
    this.config = config;
    this.queues = {};
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.maxCacheEntries = this.config?.maxCacheEntries ?? MAX_CACHE_ENTRIES;
  }

  _deleteFromCache(cacheKey) {
    if (this.cache) {
      this.cache.delete(cacheKey);
    }
    if (this.cacheExpiry) {
      this.cacheExpiry.delete(cacheKey);
    }
  }

  async fetch(url, providerId, options = {}) {
    const providerConfig = this.config?.providers?.[providerId] || {};
    let delayMs = providerConfig.requestsPerSecond 
      ? Math.ceil(1000 / providerConfig.requestsPerSecond) 
      : 0;

    // Proaktives Throttling: Für Tiingo mindestens 1200ms zwischen sequenziellen Ticker-Requests erzwingen
    if (providerId === 'Tiingo' && delayMs < 1200) {
      delayMs = 1200;
    }

    // Initialisiere die Queue für diesen Provider, falls noch nicht vorhanden
    if (!this.queues[providerId]) {
      this.queues[providerId] = Promise.resolve();
    }

    const execute = async () => {
      // Ky-Instanz mit Retry-After-Header-Auswertung (Sekunden oder Datum) und gestaffeltem Backoff
      const stagedDelays = STAGED_BACKOFF_DELAYS;
      const kyInstance = ky.extend({
        retry: {
          limit: providerConfig.maxRetries ?? 3,
          methods: ['get'],
          statusCodes: [408, 413, 429, 500, 502, 503, 504],
          afterStatusCodes: [413, 429, 503],
          maxRetryAfter: 60000,
          backoffLimit: 60000,
          delay: (attemptCount) => {
            return stagedDelays[attemptCount - 1] ?? 30000;
          }
        },
        timeout: 30000,
        hooks: {
          beforeRetry: [
            ({ request, error, retryCount }) => {
              if (error?.response?.status === 429) {
                const retryAfterHeader = error.response.headers.get('Retry-After');
                const parsedDelay = parseRetryAfter(retryAfterHeader);
                if (parsedDelay !== null) {
                  Logger.warn(`[RequestManager] HTTP 429 on ${request.url}. Inspecting Retry-After: ${retryAfterHeader} (${parsedDelay}ms). Retrying (${retryCount})...`);
                } else {
                  const fallbackDelay = stagedDelays[retryCount - 1] ?? 30000;
                  Logger.warn(`[RequestManager] HTTP 429 on ${request.url}. Retry-After missing, using staged backoff (${fallbackDelay}ms). Retrying (${retryCount})...`);
                }
              } else {
                Logger.warn(`[RequestManager] Retrying (${retryCount}) ${request.url} due to ${error.message}`);
              }
            }
          ]
        },
        ...options
      });

      try {
        let paramsString = '';
        if (options.searchParams) {
            paramsString = new URLSearchParams(options.searchParams).toString();
        }
        Logger.debug(`[HTTP GET] ${url}${paramsString ? '?' + paramsString : ''}`);
        
        const responseType = options.responseType || 'json';
        const response = await kyInstance.get(url)[responseType]();
        return response;
      } catch (error) {
        if (error.response && (error.response.status === 403 || error.response.status === 404)) {
            // Minimal logging for expected 403/404s (holidays, weekends)
            Logger.debug(`[RequestManager] Skipping ${url} (Status: ${error.response.status})`);
        } else {
            Logger.error(`[RequestManager] Final error fetching ${url}: ${error.message}`);
        }
        throw error;
      }
    };

    let paramsString = '';
    if (options.searchParams) {
        paramsString = new URLSearchParams(options.searchParams).toString();
    }
    const cacheKey = `${url}${paramsString ? '?' + paramsString : ''}`;

    if (!this.cache) this.cache = new Map();
    if (!this.cacheExpiry) this.cacheExpiry = new Map();

    if (this.cache.has(cacheKey)) {
      const expiresAt = this.cacheExpiry.get(cacheKey);
      if (expiresAt && Date.now() > expiresAt) {
        this._deleteFromCache(cacheKey);
      } else {
        const cachedPromise = this.cache.get(cacheKey);
        // LRU: Neu einhängen, damit es als Most Recently Used gilt
        this.cache.delete(cacheKey);
        this.cache.set(cacheKey, cachedPromise);
        Logger.debug(`[RequestManager] Cache hit for ${cacheKey}`);
        return cachedPromise;
      }
    }

    const promise = new Promise((resolve, reject) => {
      this.queues[providerId] = this.queues[providerId].then(async () => {
        try {
          const result = await execute();
          resolve(result);
        } catch (e) {
          // Unmittelbar im globalen Promise-Catch löschen, bevor abhängige Consumer dieselbe Instanz abgreifen
          this._deleteFromCache(cacheKey);
          reject(e);
        }
        
        // Proaktives Throttling (Warten) vor dem nächsten Request
        if (delayMs > 0) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }).catch(e => {
        this._deleteFromCache(cacheKey);
        Logger.error(`[RequestManager Queue Error] ${e.message}`);
      });
    });

    promise.catch(() => this._deleteFromCache(cacheKey));

    // LRU-Obergrenze: Älteste Einträge verdrängen, wenn Limit erreicht ist
    const maxEntries = (typeof this.maxCacheEntries === 'number' && this.maxCacheEntries > 0)
      ? this.maxCacheEntries
      : MAX_CACHE_ENTRIES;

    while (this.cache.size >= maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      this._deleteFromCache(oldestKey);
    }

    const ttl = options.ttl !== undefined
      ? options.ttl
      : (providerConfig.cacheTtl ?? this.config?.cacheTtl ?? DEFAULT_CACHE_TTL);

    if (typeof ttl === 'number' && ttl > 0) {
      this.cacheExpiry.set(cacheKey, Date.now() + ttl);
    }

    this.cache.set(cacheKey, promise);
    return promise;
  }
}
