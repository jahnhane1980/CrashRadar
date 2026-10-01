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
        if (fetcher.errorRegistry) fetcher.errorRegistry.addError(task.id, e);
        throw e;
      }
      
      if (!Array.isArray(data) || data.length === 0) break;
      
      const newLastRecord = fetcher.getLatestRecord(task, provider, data);
      try {
        await fetcher.storage.insertDataAndState(task, data, newLastRecord);
      } catch(e) {
        Logger.error(`[Storage] Error inserting data for task ${task.id}: ${e.message}`);
        if (fetcher.errorRegistry) fetcher.errorRegistry.addError(task.id, e);
        throw e;
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

    const pageSize = pagination.pageSize ?? pagination.maxLimit;
    let currentPage = pagination.startPage || 1;
    let lastDataHash = null;
    while (true) {
      searchParams.set(pagination.pageParam, currentPage);
      if (pagination.limitParam && pageSize !== undefined) {
        searchParams.set(pagination.limitParam, pageSize);
      }
      
      let response;
      try {
        response = await fetcher.requestManager.fetch(url, task.provider, { searchParams, headers });
      } catch (err) {
        let errorDetails = err?.message || '';
        if (err?.response) {
          try {
            const resClone = typeof err.response.clone === 'function' ? err.response.clone() : err.response;
            if (typeof resClone.text === 'function') {
              const bodyText = await resClone.text();
              errorDetails += ' ' + bodyText;
            }
          } catch (_) {}
        }
        if (err?.data) {
          errorDetails += ' ' + (typeof err.data === 'string' ? err.data : JSON.stringify(err.data));
        }

        const is400 = err?.status === 400 || err?.statusCode === 400 || err?.response?.status === 400 || /400/.test(err?.message || '');
        const isOutOfRange = /page number must be between/i.test(errorDetails) || /out[- ]of[- ]range/i.test(errorDetails) || /page.*between/i.test(errorDetails);

        if ((is400 && isOutOfRange) || /page number must be between/i.test(errorDetails)) {
          Logger.info(`[Pagination] Task ${task.id}: Out-of-range page number detected (${err.message}). Ending pagination cleanly.`);
          break;
        }

        Logger.error(`[API Error] Task ${task.id}: ${err.message}`);
        if (fetcher.errorRegistry) fetcher.errorRegistry.addError(task.id, err);
        throw err;
      }

      let actualData;
      try {
        actualData = fetcher.extractData(response, provider);
      } catch(e) {
        if (/page number must be between/i.test(e.message) || /out[- ]of[- ]range/i.test(e.message)) {
          Logger.info(`[Pagination] Task ${task.id}: Out-of-range page number detected (${e.message}). Ending pagination cleanly.`);
          break;
        }
        Logger.error(`[API Error] Task ${task.id}: ${e.message}`);
        if (fetcher.errorRegistry) fetcher.errorRegistry.addError(task.id, e);
        throw e;
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
        if (fetcher.errorRegistry) fetcher.errorRegistry.addError(task.id, e);
        throw e;
      }

      if (pageSize !== undefined && actualData.length < pageSize) break;

      if (response && typeof response === 'object') {
        const meta = response.meta;
        const totalPages = meta?.['total-pages'] ?? meta?.totalPages ?? response.totalPages ?? response['total-pages'];
        if (totalPages !== undefined && totalPages !== null) {
          const totalPagesNum = Number(totalPages);
          if (!isNaN(totalPagesNum) && currentPage >= totalPagesNum) {
            break;
          }
        }

        const links = response.links !== undefined ? response.links : meta?.links;
        if (links !== undefined) {
          if (!links || !links.next) {
            break;
          }
        }
      }

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
      if (fetcher.errorRegistry) fetcher.errorRegistry.addError(task.id, e);
      throw e;
    }
    
    if (finalData.length > 0) {
      try {
        const newLastRecord = fetcher.getLatestRecord(task, provider, finalData);
        await fetcher.storage.insertDataAndState(task, finalData, newLastRecord);
      } catch(e) {
        Logger.error(`[Storage] Error inserting data for task ${task.id}: ${e.message}`);
        if (fetcher.errorRegistry) fetcher.errorRegistry.addError(task.id, e);
        throw e;
      }
    }
  }
};
