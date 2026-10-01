import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaginationStrategies, SPECIAL_EXTRACT_PATHS } from '../../src/services/PaginationStrategies.js';
import { Logger } from '../../src/core/Logger.js';

describe('PaginationStrategies', () => {
  let mockFetcher;
  let context;
  let searchParams;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    searchParams = new URLSearchParams();
    mockFetcher = {
      requestManager: { fetch: vi.fn().mockResolvedValue({}) },
      extractData: vi.fn(),
      getLatestRecord: vi.fn((t, p, arr) => arr && arr.length > 0 ? arr[arr.length - 1] : null),
      storage: { insertDataAndState: vi.fn().mockResolvedValue() },
      errorRegistry: { addError: vi.fn() }
    };
    context = {
      fetcher: mockFetcher,
      task: { id: 'test-task', provider: 'Prov' },
      provider: {},
      url: 'http://test',
      headers: {},
      searchParams,
      startValue: '2023-01-01',
      pagination: { 
        startParam: 'start', 
        limitParam: 'limit', 
        maxLimit: 10 
      }
    };
    
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
  });

  // --- time-cursor ---
  describe('time-cursor strategy', () => {
    it('sollte abbrechen, wenn weniger als maxLimit geladen wurden', async () => {
      mockFetcher.extractData.mockReturnValue([['a', 'b', 'c', 'd', 'e', 'f', 12345]]); // Length 1
      await PaginationStrategies['time-cursor'](context);
      
      expect(mockFetcher.requestManager.fetch).toHaveBeenCalledTimes(1);
      expect(mockFetcher.storage.insertDataAndState).toHaveBeenCalledTimes(1);
      expect(searchParams.get('start')).toBe('2023-01-01');
      expect(searchParams.get('limit')).toBe('10');
    });

    it('sollte mehrfach fetchen, wenn maxLimit erreicht ist', async () => {
      context.pagination.cursorExtractPath = SPECIAL_EXTRACT_PATHS.LAST_ITEM_INDEX_6;
      
      const chunk1 = Array(10).fill(['a', 'b', 'c', 'd', 'e', 'f', 1000]); // 10 items (limit hit)
      const chunk2 = Array(5).fill(['a', 'b', 'c', 'd', 'e', 'f', 1001]);  // 5 items (limit not hit)
      
      mockFetcher.extractData
        .mockReturnValueOnce(chunk1)
        .mockReturnValueOnce(chunk2);

      const setSpy = vi.spyOn(searchParams, 'set');
      await PaginationStrategies['time-cursor'](context);
      
      expect(mockFetcher.requestManager.fetch).toHaveBeenCalledTimes(2);
      expect(mockFetcher.storage.insertDataAndState).toHaveBeenCalledTimes(2);
      expect(setSpy).toHaveBeenCalledWith('start', '2023-01-01');
      expect(setSpy).toHaveBeenCalledWith('start', 1001);
    });

    it('sollte abbrechen bei infinite loop (nextTime === currentStartTime)', async () => {
      context.startValue = 1000;
      context.pagination.cursorExtractPath = SPECIAL_EXTRACT_PATHS.LAST_ITEM_INDEX_6;
      const chunk1 = Array(10).fill(['a', 'b', 'c', 'd', 'e', 'f', 999]); // nextTime wird 999+1=1000 => Endlosschleife
      
      mockFetcher.extractData.mockReturnValue(chunk1);

      await PaginationStrategies['time-cursor'](context);
      
      expect(mockFetcher.requestManager.fetch).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Infinite loop detected'));
    });

    it('sollte Fehler an errorRegistry melden und rethrowen wenn extractData einen Fehler wirft', async () => {
      const err = new Error('Extract Failed');
      mockFetcher.extractData.mockImplementation(() => { throw err; });
      await expect(PaginationStrategies['time-cursor'](context)).rejects.toThrow('Extract Failed');
      expect(mockFetcher.errorRegistry.addError).toHaveBeenCalledWith('test-task', err);
      expect(mockFetcher.storage.insertDataAndState).not.toHaveBeenCalled();
    });

    it('sollte Fehler an errorRegistry melden und rethrowen wenn storage.insertDataAndState einen Fehler wirft', async () => {
      const err = new Error('Storage Failed');
      mockFetcher.extractData.mockReturnValue([[1]]);
      mockFetcher.storage.insertDataAndState.mockRejectedValue(err);
      await expect(PaginationStrategies['time-cursor'](context)).rejects.toThrow('Storage Failed');
      expect(mockFetcher.errorRegistry.addError).toHaveBeenCalledWith('test-task', err);
    });

    it('sollte abbrechen wenn leeres Array zurückkommt', async () => {
      mockFetcher.extractData.mockReturnValue([]);
      await PaginationStrategies['time-cursor'](context);
      expect(mockFetcher.storage.insertDataAndState).not.toHaveBeenCalled();
    });
  });

  // --- page-number ---
  describe('page-number strategy', () => {
    beforeEach(() => {
      context.pagination.pageParam = 'page';
    });

    it('sollte inkrementellen Filter Param anwenden', async () => {
      context.pagination.incrementalFilterParam = 'filter';
      context.task.incrementalFilterTemplate = 'date={date}';
      mockFetcher.extractData.mockReturnValue([1, 2]); // Length < limit -> break

      await PaginationStrategies['page-number'](context);
      
      expect(searchParams.get('filter')).toBe('date=2023-01-01');
      expect(searchParams.get('page')).toBe('1');
    });

    it('sollte mehrere Seiten abrufen', async () => {
      const page1 = Array(10).fill({ id: 1 });
      const page2 = Array(5).fill({ id: 2 });
      
      mockFetcher.extractData
        .mockReturnValueOnce(page1)
        .mockReturnValueOnce(page2);

      const setSpy = vi.spyOn(searchParams, 'set');
      await PaginationStrategies['page-number'](context);
      
      expect(mockFetcher.requestManager.fetch).toHaveBeenCalledTimes(2);
      expect(setSpy).toHaveBeenCalledWith('page', 1);
      expect(setSpy).toHaveBeenCalledWith('page', 2);
    });

    it('sollte abbrechen bei Endlosschleife (gleicher Hash)', async () => {
      const page1 = Array(10).fill({ id: 1 });
      mockFetcher.extractData.mockReturnValue(page1);

      await PaginationStrategies['page-number'](context);
      
      expect(mockFetcher.requestManager.fetch).toHaveBeenCalledTimes(2); // Erste Seite OK, Zweite Seite liefert exakt gleiche Daten
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('identical page returned'));
    });

    it('sollte Fehler an errorRegistry melden und rethrowen bei extractData Exception', async () => {
      const err = new Error('Page Extract Fail');
      mockFetcher.extractData.mockImplementation(() => { throw err; });
      await expect(PaginationStrategies['page-number'](context)).rejects.toThrow('Page Extract Fail');
      expect(mockFetcher.errorRegistry.addError).toHaveBeenCalledWith('test-task', err);
    });

    it('sollte Fehler an errorRegistry melden und rethrowen bei Storage Exception', async () => {
      const err = new Error('Storage Page Fail');
      mockFetcher.extractData.mockReturnValue([{id:1}]);
      mockFetcher.storage.insertDataAndState.mockRejectedValue(err);
      await expect(PaginationStrategies['page-number'](context)).rejects.toThrow('Storage Page Fail');
      expect(mockFetcher.errorRegistry.addError).toHaveBeenCalledWith('test-task', err);
    });

    it('sollte abbrechen wenn currentPage >= totalPages erreicht ist (meta["total-pages"])', async () => {
      const page1 = Array(10).fill({ id: 1 });
      mockFetcher.requestManager.fetch.mockResolvedValue({
        meta: { 'total-pages': 1 },
        data: page1
      });
      mockFetcher.extractData.mockReturnValue(page1);

      await PaginationStrategies['page-number'](context);

      expect(mockFetcher.requestManager.fetch).toHaveBeenCalledTimes(1);
      expect(mockFetcher.storage.insertDataAndState).toHaveBeenCalledTimes(1);
    });

    it('sollte abbrechen wenn currentPage >= totalPages erreicht ist (meta.totalPages)', async () => {
      const page1 = Array(10).fill({ id: 1 });
      mockFetcher.requestManager.fetch.mockResolvedValue({
        meta: { totalPages: 1 },
        data: page1
      });
      mockFetcher.extractData.mockReturnValue(page1);

      await PaginationStrategies['page-number'](context);

      expect(mockFetcher.requestManager.fetch).toHaveBeenCalledTimes(1);
      expect(mockFetcher.storage.insertDataAndState).toHaveBeenCalledTimes(1);
    });

    it('sollte abbrechen wenn links.next null ist', async () => {
      const page1 = Array(10).fill({ id: 1 });
      mockFetcher.requestManager.fetch.mockResolvedValue({
        links: { next: null },
        data: page1
      });
      mockFetcher.extractData.mockReturnValue(page1);

      await PaginationStrategies['page-number'](context);

      expect(mockFetcher.requestManager.fetch).toHaveBeenCalledTimes(1);
      expect(mockFetcher.storage.insertDataAndState).toHaveBeenCalledTimes(1);
    });

    it('sollte abbrechen wenn links.next fehlt (falsy/missing)', async () => {
      const page1 = Array(10).fill({ id: 1 });
      mockFetcher.requestManager.fetch.mockResolvedValue({
        links: { self: '/api?page=1' },
        data: page1
      });
      mockFetcher.extractData.mockReturnValue(page1);

      await PaginationStrategies['page-number'](context);

      expect(mockFetcher.requestManager.fetch).toHaveBeenCalledTimes(1);
      expect(mockFetcher.storage.insertDataAndState).toHaveBeenCalledTimes(1);
    });

    it('sollte abbrechen wenn Datenarray weniger Elemente als pageSize enthält', async () => {
      const page1 = Array(5).fill({ id: 1 }); // maxLimit is 10
      mockFetcher.extractData.mockReturnValue(page1);

      await PaginationStrategies['page-number'](context);

      expect(mockFetcher.requestManager.fetch).toHaveBeenCalledTimes(1);
      expect(mockFetcher.storage.insertDataAndState).toHaveBeenCalledTimes(1);
    });

    it('sollte bei HTTP 400 mit "page number must be between" sauber abbrechen und Logger.info rufen', async () => {
      const page1 = Array(10).fill({ id: 1 });
      const err400 = new Error('HTTP 400: The page number must be between 1 and 1.');
      err400.status = 400;

      mockFetcher.requestManager.fetch
        .mockResolvedValueOnce({ data: page1 })
        .mockRejectedValueOnce(err400);

      mockFetcher.extractData.mockReturnValue(page1);

      const loggerInfoSpy = vi.spyOn(Logger, 'info').mockImplementation(() => {});

      await expect(PaginationStrategies['page-number'](context)).resolves.not.toThrow();

      expect(mockFetcher.requestManager.fetch).toHaveBeenCalledTimes(2);
      expect(mockFetcher.storage.insertDataAndState).toHaveBeenCalledTimes(1);
      expect(mockFetcher.errorRegistry.addError).not.toHaveBeenCalled();
      expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Out-of-range page'));
    });

    it('sollte bei ky-ähnlichem HTTP 400 mit Response-Body "page number must be between" sauber abbrechen', async () => {
      const page1 = Array(10).fill({ id: 1 });
      const errKy = new Error('Request failed with status code 400 Bad Request');
      errKy.response = {
        status: 400,
        clone: () => ({
          text: async () => JSON.stringify({ message: 'The page number must be between 1 and 2.' })
        })
      };

      mockFetcher.requestManager.fetch
        .mockResolvedValueOnce({ data: page1 })
        .mockRejectedValueOnce(errKy);

      mockFetcher.extractData.mockReturnValue(page1);

      const loggerInfoSpy = vi.spyOn(Logger, 'info').mockImplementation(() => {});

      await expect(PaginationStrategies['page-number'](context)).resolves.not.toThrow();

      expect(mockFetcher.requestManager.fetch).toHaveBeenCalledTimes(2);
      expect(mockFetcher.storage.insertDataAndState).toHaveBeenCalledTimes(1);
      expect(mockFetcher.errorRegistry.addError).not.toHaveBeenCalled();
      expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Out-of-range page'));
    });

    it('sollte bei anderem HTTP 400 Fehler weiterhin werfen und errorRegistry benachrichtigen', async () => {
      const err400 = new Error('HTTP 400: Invalid filter parameter');
      err400.status = 400;

      mockFetcher.requestManager.fetch.mockRejectedValue(err400);

      await expect(PaginationStrategies['page-number'](context)).rejects.toThrow('Invalid filter parameter');
      expect(mockFetcher.errorRegistry.addError).toHaveBeenCalledWith('test-task', err400);
    });
  });

  describe('Tiingo Provider Configuration', () => {
    it('sollte concurrency=1 und requestsPerSecond=0.8 für Tiingo definiert haben', async () => {
      const { default: fs } = await import('fs');
      const { default: path } = await import('path');
      const raw = fs.readFileSync(path.resolve('config/Database-Fetcher-Config.json'), 'utf8');
      const cfg = JSON.parse(raw);
      expect(cfg.providers.Tiingo.concurrency).toBe(1);
      expect(cfg.providers.Tiingo.requestsPerSecond).toBe(0.8);
    });
  });

  // --- date-range ---
  describe('date-range strategy', () => {
    it('sollte abfragen und speichern', async () => {
      mockFetcher.extractData.mockReturnValue([{ date: '2023-01-01' }]);
      await PaginationStrategies['date-range'](context);
      expect(mockFetcher.storage.insertDataAndState).toHaveBeenCalledTimes(1);
      expect(searchParams.get('start')).toBe('2023-01-01');
    });

    it('sollte ohne limitParam klarkommen', async () => {
      delete context.pagination.limitParam;
      mockFetcher.extractData.mockReturnValue([{ date: '2023-01-01' }]);
      await PaginationStrategies['date-range'](context);
      expect(searchParams.get('limit')).toBeNull();
    });

    it('sollte Fehler an errorRegistry melden und rethrowen bei extractData Exception', async () => {
      const err = new Error('Date Extract Fail');
      mockFetcher.extractData.mockImplementation(() => { throw err; });
      await expect(PaginationStrategies['date-range'](context)).rejects.toThrow('Date Extract Fail');
      expect(mockFetcher.errorRegistry.addError).toHaveBeenCalledWith('test-task', err);
    });

    it('sollte Fehler an errorRegistry melden und rethrowen bei Storage Exception', async () => {
      const err = new Error('Storage Date Fail');
      mockFetcher.extractData.mockReturnValue([{date: '2023-01-01'}]);
      mockFetcher.storage.insertDataAndState.mockRejectedValue(err);
      await expect(PaginationStrategies['date-range'](context)).rejects.toThrow('Storage Date Fail');
      expect(mockFetcher.errorRegistry.addError).toHaveBeenCalledWith('test-task', err);
    });

    it('sollte nicht speichern bei leeren Daten', async () => {
      mockFetcher.extractData.mockReturnValue([]);
      await PaginationStrategies['date-range'](context);
      expect(mockFetcher.storage.insertDataAndState).not.toHaveBeenCalled();
    });
  });
});
