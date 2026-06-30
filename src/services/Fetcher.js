import { PaginationStrategies } from './PaginationStrategies.js';
import { FetchAdapterFactory } from '../core/adapters/fetch/FetchAdapterFactory.js';
const CONFIG_DEFAULTS = Object.freeze({
  CONCURRENCY: 5,
  FALLBACK_START_DATE: '1999-12-01',
});

const PROVIDER_TYPES = Object.freeze({
  PACKAGE: 'package',
  HTTP: 'http',
});


const DATE_FORMATS = Object.freeze({
  UNIX_MS: 'unix-ms',
  YYYY_MM_DD: 'YYYY-MM-DD',
});

const AUTH_TYPES = Object.freeze({
  HEADER: 'header',
  QUERY: 'query',
});




const API_STATUS = Object.freeze({
  ERROR: 'error',
});

export class Fetcher {
  constructor(config, storage, requestManager) {
    this.config = config;
    this.storage = storage;
    this.requestManager = requestManager;
  }

  async runAllTasks() {
    const tasks = this.config.tasks;
    const concurrency = CONFIG_DEFAULTS.CONCURRENCY;
    
    for (let i = 0; i < tasks.length; i += concurrency) {
      const chunk = tasks.slice(i, i + concurrency);
      const promises = chunk.map(task => 
        this.runTask(task).catch(e => {
          console.error(`[Error] Task ${task.id} failed entirely:`, e.message);
        })
      );
      await Promise.allSettled(promises);
    }
  }

  async runTask(task) {
    console.log(`\n--- Starting task: ${task.id} ---`);
    const provider = this.config.providers[task.provider];
    
    if (!provider) throw new Error(`Provider '${task.provider}' not found in config`);
    
    if (provider.type === PROVIDER_TYPES.PACKAGE) {
      await this.fetchViaPackage(task, provider);
    } else if (provider.type === PROVIDER_TYPES.HTTP) {
      await this.fetchViaHttp(task, provider);
    }
  }

  getStartDate(task, provider, lastRecord) {
    const pagination = provider.pagination || {};
    const dateFormat = pagination.dateFormat || DATE_FORMATS.YYYY_MM_DD;
    
    if (lastRecord) {
      const extractPath = pagination.dateExtractPath;
      const lastDateRaw = extractPath !== undefined ? lastRecord[extractPath] : undefined;
      
      if (lastDateRaw !== undefined && lastDateRaw !== null) {
        if (dateFormat === DATE_FORMATS.UNIX_MS) {
          const timestamp = parseInt(lastDateRaw, 10);
          if (!isNaN(timestamp)) return timestamp + 1; // Nächste Millisekunde
        } else if (dateFormat === DATE_FORMATS.YYYY_MM_DD) {
          // Strict string parsing to avoid Timezone offsets
          const d = new Date(lastDateRaw + 'T00:00:00.000Z');
          if (!isNaN(d.getTime())) {
            d.setUTCDate(d.getUTCDate() + 1);
            return d.toISOString().split('T')[0];
          }
        }
      }
    }
    
    // Fallback: Global oder Provider Override
    const fallbackStr = task.overrideStartDate || provider.overrideStartDate || this.config.globalStartDate || CONFIG_DEFAULTS.FALLBACK_START_DATE;
    if (dateFormat === DATE_FORMATS.UNIX_MS) {
      const timestamp = new Date(fallbackStr + 'T00:00:00.000Z').getTime();
      return isNaN(timestamp) ? Date.now() : timestamp;
    } else if (dateFormat === DATE_FORMATS.YYYY_MM_DD) {
      const d = new Date(fallbackStr + 'T00:00:00.000Z');
      return isNaN(d.getTime()) ? CONFIG_DEFAULTS.FALLBACK_START_DATE : d.toISOString().split('T')[0];
    }
    return fallbackStr;
  }

  async fetchViaPackage(task, provider) {
    if (provider.type === PROVIDER_TYPES.PACKAGE) {
      const syncState = await this.storage.getSyncState(task.id);
      const lastRecord = syncState && syncState.cursor_data ? JSON.parse(syncState.cursor_data) : null;
      
      const startValue = this.getStartDate(task, provider, lastRecord);
      const adapter = FetchAdapterFactory.get(task.provider);
      
      console.log(`[PackageFetcher] Fetching ${task.method || 'default'} for ${task.ticker || task.id}`);
        try {
        const result = await adapter.fetch(task, provider, startValue, this.requestManager);
        const newData = this.extractData(result, provider);
        
        if (newData && newData.length > 0) {
          const newLastRecord = newData[newData.length - 1];
          await this.storage.insertDataAndState(task, newData, newLastRecord);
        }
      } catch (error) {
        console.error(`[PackageFetcher Error] Task ${task.id}:`, error.message);
        throw error;
      }
    }
  }

  extractData(response, provider) {
    if (!response) return [];
    
    if (response.error || (response.status === API_STATUS.ERROR && response.message) || response.errorMessage) {
      throw new Error(`API returned error payload: ${JSON.stringify(response)}`);
    }

    if (provider.responseExtractPath) {
      return response[provider.responseExtractPath] || [];
    }

    if (Array.isArray(response)) return response;
    
    if (response.data && Array.isArray(response.data)) return response.data;
    if (response.observations && Array.isArray(response.observations)) return response.observations;
    
    if (typeof response === 'object' && Object.keys(response).length > 0) {
      return [response];
    }
    
    return [];
  }

  async fetchViaHttp(task, provider) {
    const syncState = await this.storage.getSyncState(task.id);
    const lastRecord = syncState && syncState.cursor_data ? JSON.parse(syncState.cursor_data) : null;
    const startValue = this.getStartDate(task, provider, lastRecord);
    
    const baseUrl = provider.baseUrl;
    const endpoint = task.endpoint;
    const url = `${baseUrl}${endpoint}`;
    
    let headers = provider.headers ? { ...provider.headers } : {};
    let searchParams = new URLSearchParams(task.params);
    
    if (provider.auth) {
      const authVal = process.env[provider.auth.envVar];
      if (!authVal) {
        console.warn(`[Warning] Missing environment variable ${provider.auth.envVar} for ${task.id}`);
      } else {
        if (provider.auth.type === AUTH_TYPES.HEADER) {
          headers[provider.auth.key] = `${provider.auth.prefix || ''}${authVal}`;
        } else if (provider.auth.type === AUTH_TYPES.QUERY) {
          searchParams.append(provider.auth.key, authVal);
        }
      }
    }

    const pagination = provider.pagination;

    if (!pagination) {
      const response = await this.requestManager.fetch(url, task.provider, { searchParams, headers });
      let allNewData = [];
      try {
        allNewData = this.extractData(response, provider);
      } catch(e) {
        console.error(`[API Error] Task ${task.id}:`, e.message);
        return;
      }
      if (allNewData.length > 0) {
        try {
          const lastItem = allNewData[allNewData.length - 1];
          // Cursor Extraktor: Verhindern, dass gigantische Payloads (wie SEC Edgar) 
          // als Cursor gespeichert werden und die MySQL TEXT-Spalte (65KB Limit) sprengen.
          let cursorToSave = {};
          if (typeof lastItem === 'object' && lastItem !== null) {
              const keysToKeep = ['date', 'record_date', 'observation_date', 'id', 'symbol', 'ticker', 'open_time'];
              for (const k of keysToKeep) {
                  if (lastItem[k] !== undefined) cursorToSave[k] = lastItem[k];
              }
              if (Object.keys(cursorToSave).length === 0) {
                  cursorToSave = { updated: new Date().toISOString() };
              }
          } else {
              cursorToSave = { updated: new Date().toISOString() };
          }
          await this.storage.insertDataAndState(task, allNewData, cursorToSave);
        } catch (e) {
          console.error(`[Storage] Error inserting data for task ${task.id}:`, e.message);
        }
      }
    } else {
      const strategyFn = PaginationStrategies[pagination.strategy];
      if (!strategyFn) {
        throw new Error(`Unknown pagination strategy: ${pagination.strategy}`);
      }
      
      await strategyFn({
        fetcher: this,
        task,
        provider,
        url,
        headers,
        searchParams,
        startValue,
        pagination
      });
    }
  }
}
