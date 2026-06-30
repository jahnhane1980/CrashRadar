import ky from 'ky';

export class RequestManager {
  constructor(config) {
    this.config = config;
    this.queues = {};
  }

  async fetch(url, providerId, options = {}) {
    const providerConfig = this.config?.providers?.[providerId] || {};
    const delayMs = providerConfig.requestsPerSecond 
      ? Math.ceil(1000 / providerConfig.requestsPerSecond) 
      : 0;

    // Initialisiere die Queue für diesen Provider, falls noch nicht vorhanden
    if (!this.queues[providerId]) {
      this.queues[providerId] = Promise.resolve();
    }

    const execute = async () => {
      // Ky-Instanz mit spezifischen Retry-Regeln und Timeout
      // Ky handhabt "Retry-After" Header für uns bei 429/503 automatisch!
      // Falls kein Header da ist, greift der Exponential Backoff.
      const kyInstance = ky.extend({
        retry: {
          limit: providerConfig.maxRetries ?? 3,
          methods: ['get'],
          statusCodes: [408, 413, 429, 500, 502, 503, 504],
          backoffLimit: 10000
        },
        timeout: 30000,
        hooks: {
          beforeRetry: [
            ({ request, error, retryCount }) => {
              console.warn(`[RequestManager] Retrying (${retryCount}) ${request.url} due to ${error.message}`);
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
        console.log(`[HTTP GET] ${url}${paramsString ? '?' + paramsString : ''}`);
        
        const responseType = options.responseType || 'json';
        const response = await kyInstance.get(url)[responseType]();
        return response;
      } catch (error) {
        if (error.response && (error.response.status === 403 || error.response.status === 404)) {
            // Minimal logging for expected 403/404s (holidays, weekends)
            console.log(`[RequestManager] Skipping ${url} (Status: ${error.response.status})`);
        } else {
            console.error(`[RequestManager] Final error fetching ${url}:`, error.message);
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
      console.log(`[RequestManager] Cache hit for ${cacheKey}`);
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
        console.error(`[RequestManager Queue Error] ${e.message}`);
      });
    });

    this.cache.set(url, promise);
    return promise;
  }
}
