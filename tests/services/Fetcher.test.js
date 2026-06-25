import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Fetcher } from '../../src/services/Fetcher.js';
const { mockHistorical, mockQuote, mockChart } = vi.hoisted(() => ({
  mockHistorical: vi.fn(),
  mockQuote: vi.fn(),
  mockChart: vi.fn()
}));

vi.mock('yahoo-finance2', () => {
  return {
    default: class YahooFinanceMock {
      historical = mockHistorical;
      quote = mockQuote;
      chart = mockChart;
    }
  };
});

describe('Fetcher Class', () => {
  let mockStorage;
  let mockRequestManager;
  const originalEnv = process.env;
  let mockConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    process.env = { ...originalEnv, TEST_KEY: 'secret123' };
    
    mockStorage = { 
      insertDataAndState: vi.fn(), 
      getSyncState: vi.fn().mockReturnValue(null) 
    };
    mockRequestManager = { fetch: vi.fn() };
    
    mockConfig = {
      providers: {
        "Simple": { type: "http", baseUrl: "http://simple.com", auth: null },
        "TimeCursor": {
          type: "http", baseUrl: "http://time.com",
          auth: { type: "query", key: "apiKey", envVar: "TEST_KEY" },
          pagination: { strategy: "time-cursor", limitParam: "limit", maxLimit: 2, startParam: "startTime", cursorExtractPath: "last_item_index_6", dateFormat: "unix-ms", dateExtractPath: 0 }
        },
        "PageNum": {
          type: "http", baseUrl: "http://page.com",
          auth: { type: "header", key: "Authorization", prefix: "Token ", envVar: "TEST_KEY" },
          pagination: { strategy: "page-number", limitParam: "limit", maxLimit: 2, pageParam: "page" }
        },
        "DateRange": {
          type: "http", baseUrl: "http://date.com", auth: null,
          pagination: { strategy: "date-range", limitParam: "limit", maxLimit: 5, dateFormat: "YYYY-MM-DD", dateExtractPath: "date" }
        },
        "YahooFinance": { type: "package", responseExtractPath: "quotes" }
      },
      tasks: []
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('sollte einen Package Task (YahooFinance) erfolgreich ausführen', async () => {
    mockConfig.tasks.push({ id: "t1", provider: "YahooFinance", ticker: "AAPL", method: "historical", dbKey: "db.aapl" });
    const mockData = { quotes: [{ date: '2020', close: 100 }] };
    mockHistorical.mockResolvedValue(mockData);
    
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    
    expect(mockHistorical).toHaveBeenCalledWith('AAPL', { period1: '1999-12-01' });
    expect(mockStorage.insertDataAndState).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1' }),
      mockData.quotes,
      mockData.quotes[0]
    );
  });

  it('sollte YahooFinance Daten abrufen via PACKAGE (chart method)', async () => {
    mockConfig.tasks.push({ id: "t1_chart", provider: "YahooFinance", ticker: "AAPL", method: "chart", dbKey: "db.aapl" });
    const mockData = { quotes: [{ date: '2024-01-01', close: 100 }] };
    mockChart.mockResolvedValue(mockData);
    
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    
    expect(mockChart).toHaveBeenCalled();
    expect(mockStorage.insertDataAndState).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1_chart' }),
      mockData.quotes,
      mockData.quotes[0]
    );
  });

  it('sollte Fehler bei Package Tasks abfangen', async () => {
    mockConfig.tasks.push({ id: "t1", provider: "YahooFinance", ticker: "AAPL", method: "historical", dbKey: "db.aapl" });
    mockHistorical.mockRejectedValue(new Error('Yahoo error'));
    
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[YahooFinance] Error fetching AAPL:'), 'Yahoo error');
    expect(mockStorage.insertDataAndState).not.toHaveBeenCalled();
  });

  it('sollte einen einfachen HTTP Task ohne Paginierung ausführen', async () => {
    mockConfig.tasks.push({ id: "t2", provider: "Simple", endpoint: "/data", params: { x: "1" }, dbKey: "db.simple" });
    const mockData = [{ id: 1 }];
    mockRequestManager.fetch.mockResolvedValue(mockData);
    
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    
    expect(mockRequestManager.fetch).toHaveBeenCalledWith('http://simple.com/data', 'Simple', expect.objectContaining({
      searchParams: expect.any(URLSearchParams)
    }));
    expect(mockStorage.insertDataAndState).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't2' }),
      mockData,
      mockData[0]
    );
  });

  it('sollte eine Warnung ausgeben, falls eine Env Variable für Auth fehlt', async () => {
    mockConfig.tasks.push({ id: "t3", provider: "TimeCursor", endpoint: "/data", params: {}, dbKey: "db.warn" });
    delete process.env.TEST_KEY;
    mockRequestManager.fetch.mockResolvedValue([]);
    
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[Warning] Missing environment variable TEST_KEY for t3'));
  });

  it('sollte TimeCursor Paginierung mit Auth per Query korrekt abarbeiten', async () => {
    mockConfig.tasks.push({ id: "t4", provider: "TimeCursor", endpoint: "/time", params: {}, dbKey: "db.time" });
    mockRequestManager.fetch
      .mockResolvedValueOnce([ [0,1,2,3,4,5,100], [0,1,2,3,4,5,200] ])
      .mockResolvedValueOnce([ [0,1,2,3,4,5,300] ]);
      
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    
    expect(mockRequestManager.fetch).toHaveBeenCalledTimes(2);
    const secondCallOptions = mockRequestManager.fetch.mock.calls[1][2];
    expect(secondCallOptions.searchParams.get('startTime')).toBe('201');
    expect(mockStorage.insertDataAndState).toHaveBeenCalledTimes(2);
    expect(mockStorage.insertDataAndState).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ id: 't4' }),
      [ [0,1,2,3,4,5,100], [0,1,2,3,4,5,200] ],
      [0,1,2,3,4,5,200]
    );
    expect(mockStorage.insertDataAndState).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ id: 't4' }),
      [ [0,1,2,3,4,5,300] ],
      [0,1,2,3,4,5,300]
    );
  });

  it('sollte bei unbekanntem cursorExtractPath in der TimeCursor Paginierung die Schleife abbrechen', async () => {
    mockConfig.providers.TimeCursor.pagination.cursorExtractPath = 'unknown';
    mockConfig.tasks.push({ id: "t4b", provider: "TimeCursor", endpoint: "/time", params: {}, dbKey: "db.time" });
    mockRequestManager.fetch.mockResolvedValueOnce([ [0,1,2,3,4,5,100], [0,1,2,3,4,5,200] ]);
    
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    
    expect(mockRequestManager.fetch).toHaveBeenCalledTimes(1);
  });

  it('sollte PageNum Paginierung mit Header-Auth und data-Wrapper korrekt ausführen', async () => {
    mockConfig.tasks.push({ id: "t5", provider: "PageNum", endpoint: "/page", params: {}, dbKey: "db.page" });
    mockRequestManager.fetch
      .mockResolvedValueOnce({ data: [{id:1}, {id:2}] }) 
      .mockResolvedValueOnce({ data: [{id:3}] }); 
      
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    
    expect(mockRequestManager.fetch).toHaveBeenCalledTimes(2);
    const firstCallHeaders = mockRequestManager.fetch.mock.calls[0][2].headers;
    expect(firstCallHeaders.Authorization).toBe('Token secret123'); 
    expect(mockStorage.insertDataAndState).toHaveBeenCalledTimes(2);
    expect(mockStorage.insertDataAndState).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ id: 't5' }),
      [{id:1}, {id:2}],
      {id:2}
    );
    expect(mockStorage.insertDataAndState).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ id: 't5' }),
      [{id:3}],
      {id:3}
    );
  });

  it('sollte DateRange Paginierung mit observations-Wrapper korrekt ausführen (FRED)', async () => {
    mockConfig.tasks.push({ id: "t6", provider: "DateRange", endpoint: "/date", params: {}, dbKey: "db.date" });
    mockRequestManager.fetch.mockResolvedValue({ observations: [{ val: 42 }] });
    
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    
    expect(mockStorage.insertDataAndState).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't6' }),
      [{ val: 42 }],
      { val: 42 }
    );
  });

  it('sollte DateRange Paginierung ohne Wrapper korrekt ausführen (Tiingo)', async () => {
    mockConfig.tasks.push({ id: "t6b", provider: "DateRange", endpoint: "/date", params: {}, dbKey: "db.date" });
    mockRequestManager.fetch.mockResolvedValue([{ val: 99 }]);
    
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    
    expect(mockStorage.insertDataAndState).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't6b' }),
      [{ val: 99 }],
      { val: 99 }
    );
  });

  it('sollte aus dem globalStartDate ein Unix-MS Datum berechnen, falls kein Storage-Eintrag da ist', () => {
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    const date = fetcher.getStartDate({ provider: 'Binance' }, mockConfig.providers.TimeCursor, null);
    expect(typeof date).toBe('number');
  });

  it('sollte bei YYYY-MM-DD Datum ein Tag hochzählen, falls es einen letzen Record gibt', () => {
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    const lastRecord = { date: '2020-01-01' };
    const date = fetcher.getStartDate({ provider: 'FRED' }, mockConfig.providers.DateRange, lastRecord);
    expect(date).toBe('2020-01-02');
  });

  it('sollte bei Unix-MS Datum eine Millisekunde hochzählen', () => {
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    mockConfig.providers.TimeCursor.pagination.dateExtractPath = 0;
    const lastRecord = [1000, 'open', 'high'];
    const date = fetcher.getStartDate({ provider: 'Binance' }, mockConfig.providers.TimeCursor, lastRecord);
    expect(date).toBe(1001);
  });

  it('sollte Fallback-Overrides bevorzugen', () => {
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    const date = fetcher.getStartDate({ overrideStartDate: '2015-01-01' }, mockConfig.providers.DateRange, null);
    expect(date).toBe('2015-01-01');
  });

  it('sollte DateRange Paginierung ohne Array fallback ausführen', async () => {
    mockConfig.tasks.push({ id: "t7", provider: "DateRange", endpoint: "/date", params: {}, dbKey: "db.date" });
    mockRequestManager.fetch.mockResolvedValue({ notAnArray: true });
    
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    
    expect(mockStorage.insertDataAndState).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't7' }),
      [{ notAnArray: true }],
      { notAnArray: true }
    );
  });

  it('sollte PageNum Paginierung mit incrementalFilterParam anwenden', async () => {
    mockConfig.providers.PageNum.pagination.incrementalFilterParam = 'filter';
    mockConfig.providers.PageNum.pagination.incrementalFilterTemplate = 'date>={date}';
    mockConfig.tasks.push({ id: "t8", provider: "PageNum", endpoint: "/page", params: {}, dbKey: "db.page" });
    mockRequestManager.fetch.mockResolvedValueOnce({ data: [{id:1}] }).mockResolvedValueOnce({ data: [] });
    
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    
    const fetchCall = mockRequestManager.fetch.mock.calls[0][2];
    expect(fetchCall.searchParams.get('filter')).toContain('date>=');
  });

  it('sollte fallbackStr raw zurückgeben wenn dateFormat fehlt', () => {
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    const date = fetcher.getStartDate({ overrideStartDate: '2015-01-01' }, { pagination: {} }, null);
    expect(date).toBe('2015-01-01');
  });

  it('sollte PageNum Paginierung abbrechen, falls sich die Daten nicht ändern (Infinite Loop Guard)', async () => {
    mockConfig.tasks.push({ id: "t9", provider: "PageNum", endpoint: "/page", params: {}, dbKey: "db.page" });
    const mockResponse = { data: [{id: 1}, {id: 2}] };
    mockRequestManager.fetch
      .mockResolvedValueOnce(mockResponse)
      .mockResolvedValueOnce(mockResponse)
      .mockResolvedValueOnce(mockResponse);
      
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    
    expect(mockRequestManager.fetch).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[Warning] Infinite loop detected for t9: identical page returned.'));
  });

  it('sollte TimeCursor Paginierung abbrechen, falls currentStartTime nicht ansteigt', async () => {
    mockConfig.tasks.push({ id: "t10", provider: "TimeCursor", endpoint: "/time", params: {}, dbKey: "db.time" });
    mockRequestManager.fetch
      .mockResolvedValueOnce([ [0,1,2,3,4,5,100], [0,1,2,3,4,5,200] ]) 
      .mockResolvedValueOnce([ [0,1,2,3,4,5,200], [0,1,2,3,4,5,200] ]);
      
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    
    expect(mockRequestManager.fetch).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[Warning] Infinite loop detected for t10: currentStartTime not advancing.'));
  });

  it('sollte Abstürze in HTTP-Tasks abfangen, wenn insertDataAndState fehlschlägt', async () => {
    mockConfig.tasks.push({ id: "t11", provider: "Simple", endpoint: "/data", params: { x: "1" }, dbKey: "db.simple" });
    mockRequestManager.fetch.mockResolvedValue([{ id: 1 }]);
    mockStorage.insertDataAndState.mockImplementation(() => {
      throw new Error('Storage constraint failed');
    });
    
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    // Sollte nicht crashen
    await fetcher.runAllTasks();
    
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[Storage] Error inserting data for task t11:'), 'Storage constraint failed');
  });

  // NEW TESTS FOR UNHAPPY PATHS AND 100% COVERAGE

  it('sollte Fehler abfangen, wenn der Provider nicht in der Config existiert', async () => {
    mockConfig.tasks.push({ id: "t_unknown", provider: "Ghost", endpoint: "/data" });
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[Error] Task t_unknown failed entirely:'), "Provider 'Ghost' not found in config");
  });

  it('sollte bei unbekanntem Format im getStartDate fallbackStr raw zurückgeben', () => {
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    const date = fetcher.getStartDate({ overrideStartDate: '2015-01-01' }, { pagination: { dateFormat: 'unknown' } }, null);
    expect(date).toBe('2015-01-01');
  });

  it('sollte API-Error-Payloads (.error) abfangen', () => {
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    expect(() => fetcher.extractData({ error: 'Rate limit' }, {})).toThrow(/API returned error payload/);
    expect(() => fetcher.extractData({ status: 'error', message: 'limit' }, {})).toThrow(/API returned error payload/);
    expect(() => fetcher.extractData({ errorMessage: 'error' }, {})).toThrow(/API returned error payload/);
  });

  it('sollte provider.responseExtractPath verwenden', () => {
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    const result = fetcher.extractData({ customData: [1, 2] }, { responseExtractPath: 'customData' });
    expect(result).toEqual([1, 2]);
  });

  it('sollte leeres Array zurückgeben, wenn Response null oder leer ist', () => {
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    expect(fetcher.extractData(null, {})).toEqual([]);
    expect(fetcher.extractData(42, {})).toEqual([]);
  });

  it('sollte API-Errors in HTTP Tasks ohne Paginierung abfangen', async () => {
    mockConfig.tasks.push({ id: "t_err1", provider: "Simple", endpoint: "/data", params: {}, dbKey: "db.simple" });
    mockRequestManager.fetch.mockResolvedValue({ error: 'fail' });
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[API Error] Task t_err1:'), expect.stringContaining('API returned error payload'));
  });

  it('sollte API-Errors in TimeCursor abfangen', async () => {
    mockConfig.tasks.push({ id: "t_err2", provider: "TimeCursor", endpoint: "/data", params: {}, dbKey: "db.time" });
    mockRequestManager.fetch.mockResolvedValue({ error: 'fail' });
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[API Error] Task t_err2:'), expect.stringContaining('API returned error payload'));
  });

  it('sollte API-Errors in PageNum abfangen', async () => {
    mockConfig.tasks.push({ id: "t_err3", provider: "PageNum", endpoint: "/data", params: {}, dbKey: "db.page" });
    mockRequestManager.fetch.mockResolvedValue({ error: 'fail' });
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[API Error] Task t_err3:'), expect.stringContaining('API returned error payload'));
  });

  it('sollte API-Errors in DateRange abfangen', async () => {
    mockConfig.tasks.push({ id: "t_err4", provider: "DateRange", endpoint: "/data", params: {}, dbKey: "db.date" });
    mockRequestManager.fetch.mockResolvedValue({ error: 'fail' });
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[API Error] Task t_err4:'), expect.stringContaining('API returned error payload'));
  });

  it('sollte Storage-Errors in TimeCursor abfangen', async () => {
    mockConfig.tasks.push({ id: "t_err5", provider: "TimeCursor", endpoint: "/time", params: {}, dbKey: "db.time" });
    mockRequestManager.fetch.mockResolvedValue([ [0,1,2,3,4,5,100] ]);
    mockStorage.insertDataAndState.mockImplementation(() => { throw new Error('DB Error TC'); });
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[Storage] Error inserting data for task t_err5:'), 'DB Error TC');
  });

  it('sollte Storage-Errors in PageNum abfangen', async () => {
    mockConfig.tasks.push({ id: "t_err6", provider: "PageNum", endpoint: "/page", params: {}, dbKey: "db.page" });
    mockRequestManager.fetch.mockResolvedValue({ data: [{id:1}] });
    mockStorage.insertDataAndState.mockImplementation(() => { throw new Error('DB Error PN'); });
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[Storage] Error inserting data for task t_err6:'), 'DB Error PN');
  });

  it('sollte Storage-Errors in DateRange abfangen', async () => {
    mockConfig.tasks.push({ id: "t_err7", provider: "DateRange", endpoint: "/date", params: {}, dbKey: "db.date" });
    mockRequestManager.fetch.mockResolvedValue({ observations: [{id:1}] });
    mockStorage.insertDataAndState.mockImplementation(() => { throw new Error('DB Error DR'); });
    const fetcher = new Fetcher(mockConfig, mockStorage, mockRequestManager);
    await fetcher.runAllTasks();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[Storage] Error inserting data for task t_err7:'), 'DB Error DR');
  });
});

