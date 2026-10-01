import ky from 'ky';
import { Logger } from './Logger.js';

const STAGED_BACKOFF_DELAYS = [5000, 15000, 30000];

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

    // Die eigentliche Ausführung in die Queue einhängen
    if (!this.cache) this.cache = new Map();
    if (this.cache.has(cacheKey)) {
      Logger.debug(`[RequestManager] Cache hit for ${cacheKey}`);
      return this.cache.get(cacheKey);
    }

    const promise = new Promise((resolve, reject) => {
      this.queues[providerId] = this.queues[providerId].then(async () => {
        try {
          const result = await execute();
          resolve(result);
        } catch (e) {
          reject(e);
        }
        
        // Proaktives Throttling (Warten) vor dem nächsten Request
        if (delayMs > 0) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }).catch(e => {
        Logger.error(`[RequestManager Queue Error] ${e.message}`);
      });
    });

    promise.catch(() => this.cache.delete(cacheKey));

    this.cache.set(cacheKey, promise);
    return promise;
  }
}
