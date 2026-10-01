import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PolygonM5FetchAdapter } from '../../../../src/core/adapters/fetch/PolygonM5FetchAdapter.js';
import { FetchAdapterFactory } from '../../../../src/core/adapters/fetch/FetchAdapterFactory.js';

describe('PolygonM5FetchAdapter', () => {
  let adapter;
  const originalApiKey = process.env.POLYGONIO_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.POLYGONIO_API_KEY = 'test_polygon_key';
    adapter = new PolygonM5FetchAdapter();
  });

  afterEach(() => {
    process.env.POLYGONIO_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('should call fetch with correct URL, query parameters, and Authorization header', async () => {
    const mockCandles = [
      { t: 1704067200000, o: 100, h: 105, l: 99, c: 104, v: 1000 }
    ];

    const mockResponse = {
      status: 200,
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: mockCandles,
        next_url: null
      })
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);
    vi.spyOn(adapter, 'wait').mockResolvedValue();

    const task = { ticker: 'SPY' };
    const provider = { baseUrl: 'https://api.polygon.io/v2' };
    const result = await adapter.fetch(task, provider, '2024-01-01');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = fetchSpy.mock.calls[0];

    expect(calledUrl).toContain('https://api.polygon.io/v2/aggs/ticker/SPY/range/5/minute/');
    expect(calledUrl).toContain('adjusted=true');
    expect(calledUrl).toContain('sort=asc');
    expect(calledUrl).toContain('limit=50000');
    expect(calledOptions.headers).toEqual({
      Authorization: 'Bearer test_polygon_key'
    });

    expect(result).toEqual([
      { t: 1704067200000, o: 100, h: 105, l: 99, c: 104, v: 1000 }
    ]);
  });

  it('should calculate fromMs by adding 300000 ms offset when startValue is numeric', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [], next_url: null })
    });
    vi.spyOn(adapter, 'wait').mockResolvedValue();

    const startTimestamp = 1704067200000;
    await adapter.fetch({ ticker: 'QQQ' }, {}, startTimestamp);

    const [calledUrl] = fetchSpy.mock.calls[0];
    const expectedFromMs = startTimestamp + 300000;
    expect(calledUrl).toContain(`/range/5/minute/${expectedFromMs}/`);
  });

  it('should calculate fromMs by adding 300000 ms offset when startValue has cursor timestamp object', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [], next_url: null })
    });
    vi.spyOn(adapter, 'wait').mockResolvedValue();

    const cursorObj = { t: 1704067200000 };
    await adapter.fetch({ ticker: 'QQQ' }, {}, cursorObj);

    const [calledUrl] = fetchSpy.mock.calls[0];
    const expectedFromMs = 1704067200000 + 300000;
    expect(calledUrl).toContain(`/range/5/minute/${expectedFromMs}/`);
  });

  it('should parse startValue string without offset or fallback to overrideStartDate', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [], next_url: null })
    });
    vi.spyOn(adapter, 'wait').mockResolvedValue();

    // With date string
    await adapter.fetch({ ticker: 'QQQ' }, {}, '2024-01-01');
    const expectedMs = new Date('2024-01-01').getTime();
    expect(fetchSpy.mock.calls[0][0]).toContain(`/range/5/minute/${expectedMs}/`);

    // With null fallback to overrideStartDate
    await adapter.fetch({ ticker: 'QQQ' }, { overrideStartDate: '2024-02-01' }, null);
    const expectedFallbackMs = new Date('2024-02-01').getTime();
    expect(fetchSpy.mock.calls[1][0]).toContain(`/range/5/minute/${expectedFallbackMs}/`);
  });

  it('should return [] early when fromMs is in the future (>= Date.now())', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const futureMs = Date.now() + 1000000;

    const result = await adapter.fetch({ ticker: 'SPY' }, {}, futureMs);

    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should handle next_url pagination and aggregate candles into a flat array', async () => {
    const page1Candle = { t: 1704067200000, o: 10, h: 12, l: 9, c: 11, v: 100 };
    const page2Candle = { t: 1704067500000, o: 11, h: 13, l: 10, c: 12, v: 200 };

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [page1Candle],
          next_url: 'https://api.polygon.io/v2/aggs/ticker/SPY/range/5/minute?cursor=page2cursor'
        })
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [page2Candle],
          next_url: null
        })
      });

    const waitSpy = vi.spyOn(adapter, 'wait').mockResolvedValue();

    const result = await adapter.fetch({ ticker: 'SPY' }, {}, '2024-01-01');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1][0]).toBe('https://api.polygon.io/v2/aggs/ticker/SPY/range/5/minute?cursor=page2cursor');
    expect(fetchSpy.mock.calls[1][1].headers).toEqual({
      Authorization: 'Bearer test_polygon_key'
    });

    // Pacing throttle between paginated calls should be called
    expect(waitSpy).toHaveBeenCalledWith(12500);

    expect(result).toEqual([
      { t: 1704067200000, o: 10, h: 12, l: 9, c: 11, v: 100 },
      { t: 1704067500000, o: 11, h: 13, l: 10, c: 12, v: 200 }
    ]);
  });

  it('should enforce 12500ms throttling between consecutive calls', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [], next_url: null })
    });
    const waitSpy = vi.spyOn(adapter, 'wait').mockResolvedValue();

    // Call 1
    await adapter.fetch({ ticker: 'SPY' }, {}, '2024-01-01');
    expect(waitSpy).not.toHaveBeenCalled();

    // Consecutive call 2 immediately after
    await adapter.fetch({ ticker: 'QQQ' }, {}, '2024-01-01');
    expect(waitSpy).toHaveBeenCalledWith(12500);
  });

  it('should sleep 65000ms and retry upon HTTP 429 up to 3 times', async () => {
    const candle = { t: 1704067200000, o: 10, h: 12, l: 9, c: 11, v: 100 };

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        status: 429,
        ok: false,
        statusText: 'Too Many Requests'
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [candle],
          next_url: null
        })
      });

    const waitSpy = vi.spyOn(adapter, 'wait').mockResolvedValue();

    const result = await adapter.fetch({ ticker: 'SPY' }, {}, '2024-01-01');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(waitSpy).toHaveBeenCalledWith(65000);
    expect(result).toEqual([candle]);
  });

  it('should throw an error after exceeding 3 retries on HTTP 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 429,
      ok: false,
      statusText: 'Too Many Requests'
    });

    const waitSpy = vi.spyOn(adapter, 'wait').mockResolvedValue();

    await expect(adapter.fetch({ ticker: 'SPY' }, {}, '2024-01-01')).rejects.toThrow(
      /HTTP 429/i
    );

    // Initial attempt + 3 retries = 4 fetch calls, 3 sleeps of 65000ms
    expect(waitSpy).toHaveBeenCalledWith(65000);
    expect(waitSpy.mock.calls.filter(call => call[0] === 65000)).toHaveLength(3);
  });

  it('should be registered in FetchAdapterFactory under key "PolygonM5"', () => {
    const factoryAdapter = FetchAdapterFactory.get('PolygonM5');
    expect(factoryAdapter).toBeInstanceOf(PolygonM5FetchAdapter);
  });
});
