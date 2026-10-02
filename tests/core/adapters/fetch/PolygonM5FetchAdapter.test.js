import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PolygonM5FetchAdapter } from '../../../../src/core/adapters/fetch/PolygonM5FetchAdapter.js';
import { FetchAdapterFactory } from '../../../../src/core/adapters/fetch/FetchAdapterFactory.js';
import { RequestManager } from '../../../../src/core/RequestManager.js';
import { Logger } from '../../../../src/core/Logger.js';
import { bootstrapAdapters } from '../../../../src/core/adapters/bootstrap.js';

describe('PolygonM5FetchAdapter', () => {
  bootstrapAdapters();

  let adapter;
  let mockRequestManager;
  const originalApiKey = process.env.POLYGONIO_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.POLYGONIO_API_KEY = 'test_polygon_key';
    mockRequestManager = {
      fetch: vi.fn()
    };
    adapter = new PolygonM5FetchAdapter(mockRequestManager);
  });

  afterEach(() => {
    process.env.POLYGONIO_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('should route all HTTP calls through requestManager.fetch and NOT use global fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const mockCandles = [
      { t: 1704067200000, o: 100, h: 105, l: 99, c: 104, v: 1000 }
    ];

    mockRequestManager.fetch.mockResolvedValue({
      results: mockCandles,
      next_url: null
    });

    const task = { ticker: 'SPY', provider: 'PolygonM5' };
    const provider = {
      baseUrl: 'https://api.polygon.io/v2',
      auth: {
        type: 'header',
        key: 'Authorization',
        prefix: 'Bearer ',
        envVar: 'POLYGONIO_API_KEY'
      }
    };

    const result = await adapter.fetch(task, provider, '2024-01-01');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockRequestManager.fetch).toHaveBeenCalledTimes(1);

    const [calledUrl, calledProviderId, calledOptions] = mockRequestManager.fetch.mock.calls[0];
    expect(calledUrl).toContain('https://api.polygon.io/v2/aggs/ticker/SPY/range/5/minute/');
    expect(calledUrl).toContain('adjusted=true');
    expect(calledUrl).toContain('sort=asc');
    expect(calledUrl).toContain('limit=50000');
    expect(calledProviderId).toBe('PolygonM5');
    expect(calledOptions.headers).toEqual({
      Authorization: 'Bearer test_polygon_key'
    });

    expect(result).toEqual([
      { t: 1704067200000, o: 100, h: 105, l: 99, c: 104, v: 1000 }
    ]);
  });

  it('should accept requestManager via fetch method parameter if not in constructor', async () => {
    const adapterWithoutRm = new PolygonM5FetchAdapter();
    mockRequestManager.fetch.mockResolvedValue({ results: [], next_url: null });

    const task = { ticker: 'SPY' };
    const provider = { baseUrl: 'https://api.polygon.io/v2' };

    await adapterWithoutRm.fetch(task, provider, '2024-01-01', mockRequestManager);

    expect(mockRequestManager.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if no RequestManager is provided', async () => {
    const adapterWithoutRm = new PolygonM5FetchAdapter();
    const task = { ticker: 'SPY' };
    const provider = { baseUrl: 'https://api.polygon.io/v2' };

    await expect(adapterWithoutRm.fetch(task, provider, '2024-01-01')).rejects.toThrow(
      /RequestManager is required/i
    );
  });

  it('should extract auth dynamically from provider.auth configuration', async () => {
    process.env.CUSTOM_POLYGON_VAR = 'secret_custom_token';
    mockRequestManager.fetch.mockResolvedValue({ results: [], next_url: null });

    const task = { ticker: 'QQQ', provider: 'PolygonM5' };
    const provider = {
      baseUrl: 'https://api.polygon.io/v2',
      auth: {
        type: 'header',
        key: 'Authorization',
        prefix: 'Bearer ',
        envVar: 'CUSTOM_POLYGON_VAR'
      }
    };

    await adapter.fetch(task, provider, '2024-01-01');

    const [, , calledOptions] = mockRequestManager.fetch.mock.calls[0];
    expect(calledOptions.headers.Authorization).toBe('Bearer secret_custom_token');
    delete process.env.CUSTOM_POLYGON_VAR;
  });

  it('should warn when configured auth envVar is missing in environment', async () => {
    const warnSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    delete process.env.MISSING_KEY;
    mockRequestManager.fetch.mockResolvedValue({ results: [], next_url: null });

    const task = { ticker: 'SPY', provider: 'PolygonM5' };
    const provider = {
      baseUrl: 'https://api.polygon.io/v2',
      auth: {
        type: 'header',
        key: 'Authorization',
        prefix: 'Bearer ',
        envVar: 'MISSING_KEY'
      }
    };

    await adapter.fetch(task, provider, '2024-01-01');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('MISSING_KEY'));
  });

  it('should fallback to POLYGONIO_API_KEY when provider.auth is not present', async () => {
    mockRequestManager.fetch.mockResolvedValue({ results: [], next_url: null });

    const task = { ticker: 'SPY', provider: 'PolygonM5' };
    const provider = { baseUrl: 'https://api.polygon.io/v2' };

    await adapter.fetch(task, provider, '2024-01-01');

    const [, , calledOptions] = mockRequestManager.fetch.mock.calls[0];
    expect(calledOptions.headers.Authorization).toBe('Bearer test_polygon_key');
  });

  it('should handle pagination via next_url through requestManager.fetch', async () => {
    const page1Candle = { t: 1704067200000, o: 10, h: 12, l: 9, c: 11, v: 100 };
    const page2Candle = { t: 1704067500000, o: 11, h: 13, l: 10, c: 12, v: 200 };

    mockRequestManager.fetch
      .mockResolvedValueOnce({
        results: [page1Candle],
        next_url: 'https://api.polygon.io/v2/aggs/ticker/SPY/range/5/minute?cursor=page2cursor'
      })
      .mockResolvedValueOnce({
        results: [page2Candle],
        next_url: null
      });

    const result = await adapter.fetch({ ticker: 'SPY', provider: 'PolygonM5' }, {}, '2024-01-01');

    expect(mockRequestManager.fetch).toHaveBeenCalledTimes(2);
    expect(mockRequestManager.fetch.mock.calls[1][0]).toBe(
      'https://api.polygon.io/v2/aggs/ticker/SPY/range/5/minute?cursor=page2cursor'
    );
    expect(mockRequestManager.fetch.mock.calls[1][1]).toBe('PolygonM5');
    expect(result).toEqual([
      { t: 1704067200000, o: 10, h: 12, l: 9, c: 11, v: 100 },
      { t: 1704067500000, o: 11, h: 13, l: 10, c: 12, v: 200 }
    ]);
  });

  it('should calculate fromMs by adding 300000 ms offset when startValue is numeric', async () => {
    mockRequestManager.fetch.mockResolvedValue({ results: [], next_url: null });

    const startTimestamp = 1704067200000;
    await adapter.fetch({ ticker: 'QQQ' }, {}, startTimestamp);

    const [calledUrl] = mockRequestManager.fetch.mock.calls[0];
    const expectedFromMs = startTimestamp + 300000;
    expect(calledUrl).toContain(`/range/5/minute/${expectedFromMs}/`);
  });

  it('should calculate fromMs by adding 300000 ms offset when startValue has cursor timestamp object', async () => {
    mockRequestManager.fetch.mockResolvedValue({ results: [], next_url: null });

    const cursorObj = { t: 1704067200000 };
    await adapter.fetch({ ticker: 'QQQ' }, {}, cursorObj);

    const [calledUrl] = mockRequestManager.fetch.mock.calls[0];
    const expectedFromMs = 1704067200000 + 300000;
    expect(calledUrl).toContain(`/range/5/minute/${expectedFromMs}/`);
  });

  it('should parse startValue string without offset or fallback to overrideStartDate', async () => {
    mockRequestManager.fetch.mockResolvedValue({ results: [], next_url: null });

    // With date string
    await adapter.fetch({ ticker: 'QQQ' }, {}, '2024-01-01');
    const expectedMs = new Date('2024-01-01').getTime();
    expect(mockRequestManager.fetch.mock.calls[0][0]).toContain(`/range/5/minute/${expectedMs}/`);

    // With null fallback to overrideStartDate
    await adapter.fetch({ ticker: 'QQQ' }, { overrideStartDate: '2024-02-01' }, null);
    const expectedFallbackMs = new Date('2024-02-01').getTime();
    expect(mockRequestManager.fetch.mock.calls[1][0]).toContain(`/range/5/minute/${expectedFallbackMs}/`);
  });

  it('should return [] early when fromMs is in the future (>= Date.now())', async () => {
    const futureMs = Date.now() + 1000000;

    const result = await adapter.fetch({ ticker: 'SPY' }, {}, futureMs);

    expect(result).toEqual([]);
    expect(mockRequestManager.fetch).not.toHaveBeenCalled();
  });

  it('should integrate with RequestManager using provider configuration for throttling and auth', async () => {
    const config = {
      providers: {
        PolygonM5: {
          requestsPerSecond: 0.08,
          auth: {
            type: 'header',
            key: 'Authorization',
            prefix: 'Bearer ',
            envVar: 'POLYGONIO_API_KEY'
          }
        }
      }
    };
    const realRequestManager = new RequestManager(config);
    const rmFetchSpy = vi.spyOn(realRequestManager, 'fetch').mockResolvedValue({
      results: [{ t: 1704067200000, o: 10, h: 12, l: 9, c: 11, v: 100 }],
      next_url: null
    });

    const testAdapter = new PolygonM5FetchAdapter(realRequestManager);
    const providerConfig = config.providers.PolygonM5;
    const task = { ticker: 'SPY', provider: 'PolygonM5' };

    const result = await testAdapter.fetch(task, providerConfig, '2024-01-01');

    expect(rmFetchSpy).toHaveBeenCalledTimes(1);
    expect(rmFetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/aggs/ticker/SPY/range/5/minute/'),
      'PolygonM5',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer test_polygon_key'
        }
      })
    );
    expect(result).toHaveLength(1);
  });

  it('should be registered in FetchAdapterFactory under key "PolygonM5"', () => {
    const factoryAdapter = FetchAdapterFactory.getAdapter('PolygonM5');
    expect(factoryAdapter).toBeInstanceOf(PolygonM5FetchAdapter);
  });
});
