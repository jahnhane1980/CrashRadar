import { Logger } from '../core/Logger.js';

export const SPECIAL_EXTRACT_PATHS = Object.freeze({
  LAST_ITEM_INDEX_6: 'last_item_index_6',
});

export const PaginationStrategies = {
  'time-cursor': async ({ fetcher, task, provider, url, headers, searchParams, startValue, pagination }) => {
    searchParams.set(pagination.startParam, startValue);
    let currentStartTime = startValue;
    
    while (true) {
      if (currentStartTime !== undefined && currentStartTime !== null) {
        searchParams.set(pagination.startParam, currentStartTime);
      }
      searchParams.set(pagination.limitParam, pagination.maxLimit);
      
      const response = await fetcher.requestManager.fetch(url, task.provider, { searchParams, headers });
      let data;
      try {
        data = fetcher.extractData(response, provider);
      } catch(e) {
        Logger.error(`[API Error] Task ${task.id}: ${e.message}`);
        break;
      }
      
      if (!Array.isArray(data) || data.length === 0) break;
      
      const newLastRecord = fetcher.getLatestRecord(task, provider, data);
      try {
        await fetcher.storage.insertDataAndState(task, data, newLastRecord);
      } catch(e) {
        Logger.error(`[Storage] Error inserting data for task ${task.id}: ${e.message}`);
        break;
      }
      
      if (data.length < pagination.maxLimit) break;
      
      if (pagination.cursorExtractPath === SPECIAL_EXTRACT_PATHS.LAST_ITEM_INDEX_6) {
        const nextTime = newLastRecord[6] + 1;
        if (nextTime === currentStartTime || isNaN(nextTime)) {
          Logger.warn(`[Warning] Infinite loop detected for ${task.id}: currentStartTime not advancing.`);
          break;
        }
        currentStartTime = nextTime;
      } else {
        break;
      }
    }
  },

  'page-number': async ({ fetcher, task, provider, url, headers, searchParams, startValue, pagination }) => {
    if (pagination.incrementalFilterParam) {
      const template = task.incrementalFilterTemplate || pagination.incrementalFilterTemplate;
      const filterStr = template.replace('{date}', startValue);
      searchParams.set(pagination.incrementalFilterParam, filterStr);
    }

    let currentPage = pagination.startPage || 1;
    let lastDataHash = null;
    while (true) {
      searchParams.set(pagination.pageParam, currentPage);
      searchParams.set(pagination.limitParam, pagination.maxLimit);
      
      const response = await fetcher.requestManager.fetch(url, task.provider, { searchParams, headers });
      let actualData;
      try {
        actualData = fetcher.extractData(response, provider);
      } catch(e) {
        Logger.error(`[API Error] Task ${task.id}: ${e.message}`);
        break;
      }
      
      if (!Array.isArray(actualData) || actualData.length === 0) break;
      
      const currentDataHash = JSON.stringify(actualData);
      if (currentDataHash === lastDataHash) {
        Logger.warn(`[Warning] Infinite loop detected for ${task.id}: identical page returned.`);
        break;
      }
      lastDataHash = currentDataHash;

      const newLastRecord = fetcher.getLatestRecord(task, provider, actualData);
      try {
        await fetcher.storage.insertDataAndState(task, actualData, newLastRecord);
      } catch(e) {
        Logger.error(`[Storage] Error inserting data for task ${task.id}: ${e.message}`);
        break;
      }

      if (actualData.length < pagination.maxLimit) break;
      currentPage++;
    }
  },

  'date-range': async ({ fetcher, task, provider, url, headers, searchParams, startValue, pagination }) => {
    searchParams.set(pagination.startParam, startValue);
    if (pagination.limitParam) {
      searchParams.set(pagination.limitParam, pagination.maxLimit);
    }
    const response = await fetcher.requestManager.fetch(url, task.provider, { searchParams, headers });
    let finalData;
    try {
      finalData = fetcher.extractData(response, provider);
    } catch(e) {
      Logger.error(`[API Error] Task ${task.id}: ${e.message}`);
      return;
    }
    
    if (finalData.length > 0) {
      try {
        const newLastRecord = fetcher.getLatestRecord(task, provider, finalData);
        await fetcher.storage.insertDataAndState(task, finalData, newLastRecord);
      } catch(e) {
        Logger.error(`[Storage] Error inserting data for task ${task.id}: ${e.message}`);
      }
    }
  }
};
