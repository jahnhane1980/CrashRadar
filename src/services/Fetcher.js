import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

const CONFIG_DEFAULTS = Object.freeze({
  CONCURRENCY: 10,
  FALLBACK_START_DATE: '1999-12-01',
});

const PROVIDER_TYPES = Object.freeze({
  PACKAGE: 'package',
  HTTP: 'http',
});

const PROVIDER_NAMES = Object.freeze({
  YAHOO_FINANCE: 'YahooFinance',
});

const DATE_FORMATS = Object.freeze({
  UNIX_MS: 'unix-ms',
  YYYY_MM_DD: 'YYYY-MM-DD',
});

const AUTH_TYPES = Object.freeze({
  HEADER: 'header',
  QUERY: 'query',
});

const PAGINATION_STRATEGIES = Object.freeze({
  TIME_CURSOR: 'time-cursor',
  PAGE_NUMBER: 'page-number',
  DATE_RANGE: 'date-range',
});

const SPECIAL_EXTRACT_PATHS = Object.freeze({
  LAST_ITEM_INDEX_6: 'last_item_index_6',
});

const YAHOO_FINANCE_DEFAULTS = Object.freeze({
  START_PARAM: 'period1',
  METHOD_CHART: 'chart',
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
          const d = new Date(lastDateRaw);
          if (!isNaN(d.getTime())) {
            d.setUTCDate(d.getUTCDate() + 1); // Nächster Tag
            return d.toISOString().split('T')[0];
          }
        }
      }
    }
    
    // Fallback: Global oder Provider Override
    const fallbackStr = task.overrideStartDate || provider.overrideStartDate || this.config.globalStartDate || CONFIG_DEFAULTS.FALLBACK_START_DATE;
    if (dateFormat === DATE_FORMATS.UNIX_MS) {
      const timestamp = new Date(fallbackStr).getTime();
      return isNaN(timestamp) ? Date.now() : timestamp;
    } else if (dateFormat === DATE_FORMATS.YYYY_MM_DD) {
      const d = new Date(fallbackStr);
      return isNaN(d.getTime()) ? CONFIG_DEFAULTS.FALLBACK_START_DATE : d.toISOString().split('T')[0];
    }
    return fallbackStr;
  }

  async fetchViaPackage(task, provider) {
    if (provider.type === PROVIDER_TYPES.PACKAGE && task.provider === PROVIDER_NAMES.YAHOO_FINANCE) {
      const syncState = await this.storage.getSyncState(task.id);
      const lastRecord = syncState && syncState.cursor_data ? JSON.parse(syncState.cursor_data) : null;
      
      const startValue = this.getStartDate(task, provider, lastRecord);
      const options = task.options || {};
      options[provider.pagination?.startParam || YAHOO_FINANCE_DEFAULTS.START_PARAM] = startValue;
      
      console.log(`[YahooFinance] Fetching ${task.method} for ${task.ticker} with options`, options);
      try {
        const result = await yahooFinance[task.method](task.ticker, options);
        let newData = result;
        if (task.method === YAHOO_FINANCE_DEFAULTS.METHOD_CHART && result && result.quotes) {
           newData = result.quotes;
        }
        if (newData && newData.length > 0) {
          const newLastRecord = newData[newData.length - 1];
          await this.storage.insertDataAndState(task, newData, newLastRecord);
        }
      } catch (error) {
        console.error(`[YahooFinance] Error fetching ${task.ticker}:`, error.message);
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
    
    let headers = {};
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
          await this.storage.insertDataAndState(task, allNewData, allNewData[allNewData.length - 1]);
        } catch (e) {
          console.error(`[Storage] Error inserting data for task ${task.id}:`, e.message);
        }
      }
    } else {
      if (pagination.strategy === PAGINATION_STRATEGIES.TIME_CURSOR || pagination.strategy === PAGINATION_STRATEGIES.DATE_RANGE) {
        searchParams.set(pagination.startParam, startValue);
      } else if (pagination.strategy === PAGINATION_STRATEGIES.PAGE_NUMBER && pagination.incrementalFilterParam) {
        const template = task.incrementalFilterTemplate || pagination.incrementalFilterTemplate;
        const filterStr = template.replace('{date}', startValue);
        searchParams.set(pagination.incrementalFilterParam, filterStr);
      }

      if (pagination.strategy === PAGINATION_STRATEGIES.TIME_CURSOR) {
        let currentStartTime = startValue;
        while (true) {
          if (currentStartTime !== undefined && currentStartTime !== null) {
            searchParams.set(pagination.startParam, currentStartTime);
          }
          searchParams.set(pagination.limitParam, pagination.maxLimit);
          
          const response = await this.requestManager.fetch(url, task.provider, { searchParams, headers });
          let data;
          try {
            data = this.extractData(response, provider);
          } catch(e) {
            console.error(`[API Error] Task ${task.id}:`, e.message);
            break;
          }
          if (!Array.isArray(data) || data.length === 0) break;
          
          const newLastRecord = data[data.length - 1];
          try {
            await this.storage.insertDataAndState(task, data, newLastRecord);
          } catch(e) {
            console.error(`[Storage] Error inserting data for task ${task.id}:`, e.message);
            break;
          }
          
          if (data.length < pagination.maxLimit) break;
          
          if (pagination.cursorExtractPath === SPECIAL_EXTRACT_PATHS.LAST_ITEM_INDEX_6) {
            const nextTime = newLastRecord[6] + 1;
            if (nextTime === currentStartTime || isNaN(nextTime)) {
              console.warn(`[Warning] Infinite loop detected for ${task.id}: currentStartTime not advancing.`);
              break;
            }
            currentStartTime = nextTime;
          } else {
            break;
          }
        }
      } else if (pagination.strategy === PAGINATION_STRATEGIES.PAGE_NUMBER) {
        let currentPage = pagination.startPage || 1;
        let lastDataHash = null;
        while (true) {
          searchParams.set(pagination.pageParam, currentPage);
          searchParams.set(pagination.limitParam, pagination.maxLimit);
          
          const response = await this.requestManager.fetch(url, task.provider, { searchParams, headers });
          let actualData;
          try {
            actualData = this.extractData(response, provider);
          } catch(e) {
            console.error(`[API Error] Task ${task.id}:`, e.message);
            break;
          }
          
          if (!Array.isArray(actualData) || actualData.length === 0) break;
          
          const currentDataHash = JSON.stringify(actualData);
          if (currentDataHash === lastDataHash) {
            console.warn(`[Warning] Infinite loop detected for ${task.id}: identical page returned.`);
            break;
          }
          lastDataHash = currentDataHash;

          const newLastRecord = actualData[actualData.length - 1];
          try {
            await this.storage.insertDataAndState(task, actualData, newLastRecord);
          } catch(e) {
            console.error(`[Storage] Error inserting data for task ${task.id}:`, e.message);
            break;
          }

          if (actualData.length < pagination.maxLimit) break;
          currentPage++;
        }
      } else if (pagination.strategy === PAGINATION_STRATEGIES.DATE_RANGE) {
        if (pagination.limitParam) {
          searchParams.set(pagination.limitParam, pagination.maxLimit);
        }
        const response = await this.requestManager.fetch(url, task.provider, { searchParams, headers });
        let finalData;
        try {
          finalData = this.extractData(response, provider);
        } catch(e) {
          console.error(`[API Error] Task ${task.id}:`, e.message);
          return;
        }
        
        if (finalData.length > 0) {
          try {
            const newLastRecord = finalData[finalData.length - 1];
            await this.storage.insertDataAndState(task, finalData, newLastRecord);
          } catch(e) {
            console.error(`[Storage] Error inserting data for task ${task.id}:`, e.message);
          }
        }
      }
    }
  }
}
