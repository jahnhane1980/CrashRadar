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
        console.log(`[HTTP GET] ${url}?${options.searchParams?.toString() || ''}`);
        const response = await kyInstance.get(url).json();
        return response;
      } catch (error) {
        console.error(`[RequestManager] Final error fetching ${url}:`, error.message);
        return [];
      }
    };

    // Die eigentliche Ausführung in die Queue einhängen
    return new Promise((resolve) => {
      this.queues[providerId] = this.queues[providerId].then(async () => {
        try {
          const result = await execute();
          resolve(result);
        } catch (e) {
          /* v8 ignore next */
          resolve([]); // Fallback
        }
        
        // Proaktives Throttling (Warten) vor dem nächsten Request
        if (delayMs > 0) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }).catch(() => {
        /* v8 ignore next */
        resolve([]);
      });
    });
  }
}
