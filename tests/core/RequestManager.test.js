import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequestManager } from '../../src/core/RequestManager.js';
import { Logger } from '../../src/core/Logger.js';
import ky from 'ky';

// Wir mocken 'ky', um die internen HTTP Aufrufe zu simulieren ohne echte Netzwerkanfragen zu senden.
vi.mock('ky', () => {
  const getMock = vi.fn();
  const extendMock = vi.fn().mockReturnValue({
    get: getMock
  });
  return {
    default: {
      extend: extendMock,
      get: getMock 
    }
  };
});

describe('RequestManager Class', () => {
  let config;

  let loggerDebugSpy;
  let loggerWarnSpy;
  let loggerErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    Logger.setLevel('DEBUG');
    loggerDebugSpy = vi.spyOn(Logger, 'debug').mockImplementation(() => {});
    loggerWarnSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    loggerErrorSpy = vi.spyOn(Logger, 'error').mockImplementation(() => {});
    
    config = {
      providers: {
        "FastProv": {},
        "SlowProv": { requestsPerSecond: 10, maxRetries: 2 } // 10 req/s = 100ms delay
      }
    };
  });

  it('sollte Anfragen an einen Provider ohne Delay direkt durchreichen', async () => {
    const manager = new RequestManager(config);
    const mockJson = vi.fn().mockResolvedValue({ id: 1 });
    
    const kyExtendMock = ky.extend();
    kyExtendMock.get.mockReturnValue({ json: mockJson });
    
    const result = await manager.fetch('http://fast.com', 'FastProv', { headers: { 'x': '1' } });
    
    expect(result).toEqual({ id: 1 });
    expect(ky.extend).toHaveBeenCalledWith(expect.objectContaining({
      headers: { 'x': '1' },
      timeout: 30000
    }));
    expect(kyExtendMock.get).toHaveBeenCalledWith('http://fast.com');
  });

  it('sollte Fehler werfen (z.B. 404, 429 nach allen Retries)', async () => {
    const manager = new RequestManager(config);
    const kyExtendMock = ky.extend();
    kyExtendMock.get.mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error('Not Found'))
    });
    
    await expect(manager.fetch('http://error.com', 'FastProv')).rejects.toThrow('Not Found');
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[RequestManager] Final error fetching http://error.com: Not Found'));
  });

  it('sollte das Queue-Delay (100ms) zwischen zwei Anfragen auf demselben Provider anwenden', async () => {
    const manager = new RequestManager(config);
    const kyExtendMock = ky.extend();
    kyExtendMock.get.mockReturnValue({ json: vi.fn().mockResolvedValue({ ok: true }) });
    
    const start = Date.now();
    // Startet zwei Anfragen fast gleichzeitig an denselben Provider
    const p1 = manager.fetch('http://slow.com/1', 'SlowProv');
    const p2 = manager.fetch('http://slow.com/2', 'SlowProv');
    
    await Promise.all([p1, p2]);
    const end = Date.now();
    
    // Die zweite Anfrage muss durch die Queue warten (100ms)
    // Erlauben leichte Toleranz für Test-Umgebungen
    expect(end - start).toBeGreaterThanOrEqual(95); 
  });

  it('sollte den beforeRetry Hook definieren und bei Retries Warnungen loggen', async () => {
    const manager = new RequestManager(config);
    const kyExtendMock = ky.extend();
    kyExtendMock.get.mockReturnValue({ json: vi.fn().mockResolvedValue([]) });
    
    await manager.fetch('http://retry.com', 'SlowProv');
    
    // Wir extrahieren das Config-Objekt, das an ky.extend übergeben wurde
    const extendArgs = ky.extend.mock.calls[ky.extend.mock.calls.length - 1][0];
    expect(extendArgs.hooks.beforeRetry).toHaveLength(1);
    
    // Hook manuell aufrufen um Verhalten zu testen (Simulation von ky's internem Aufruf)
    const hook = extendArgs.hooks.beforeRetry[0];
    hook({ request: { url: 'http://retry.com' }, error: { message: 'Timeout' }, retryCount: 1 });
    
    expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[RequestManager] Retrying (1) http://retry.com due to Timeout'));
  });

  it('sollte die Queue nicht blockieren, wenn eine unerwartete Exception auftritt', async () => {
    const manager = new RequestManager(config);
    const kyExtendMock = ky.extend();
    
    // Erste Anfrage crasht hart
    kyExtendMock.get.mockImplementationOnce(() => { throw new Error('Hard Crash') });
    // Zweite Anfrage funktioniert
    kyExtendMock.get.mockImplementationOnce(() => ({ json: vi.fn().mockResolvedValue({ ok: true }) }));
    
    await expect(manager.fetch('http://crash.com', 'FastProv')).rejects.toThrow('Hard Crash');
    
    const result2 = await manager.fetch('http://crash.com/2', 'FastProv');
    
    expect(result2).toEqual({ ok: true });
    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
  });

  it('sollte Anfragen ohne Absturz ausführen, wenn Config oder Provider fehlen', async () => {
    const emptyManager = new RequestManager(null);
    const kyExtendMock = ky.extend();
    kyExtendMock.get.mockReturnValue({ json: vi.fn().mockResolvedValue({ default: true }) });
    
    const result = await emptyManager.fetch('http://noconfig.com', 'UnknownProv');
    expect(result).toEqual({ default: true });
    
    // Default Retry Limit von 3 sollte verwendet werden
    const extendArgs = ky.extend.mock.calls[ky.extend.mock.calls.length - 1][0];
    expect(extendArgs.retry.limit).toBe(3);
  });

  it('sollte searchParams im Konsolen-Log korrekt anhängen', async () => {
    const manager = new RequestManager(config);
    const kyExtendMock = ky.extend();
    kyExtendMock.get.mockReturnValue({ json: vi.fn().mockResolvedValue({ ok: true }) });
    
    kyExtendMock.get.mockReturnValue({ json: vi.fn().mockResolvedValue({ ok: true }) });
    const searchParams = new URLSearchParams({ test: '123', abc: 'xyz' });
    
    await manager.fetch('http://log.com', 'FastProv', { searchParams });
    
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('[HTTP GET] http://log.com?test=123&abc=xyz'));
  });

  it('sollte delayMs auch nach einem Error abwarten, um die Queue nicht zu überfluten', async () => {
    const manager = new RequestManager(config);
    const kyExtendMock = ky.extend();
    
    // Die erste Anfrage crasht, ist aber für einen SlowProvider (100ms Delay)
    kyExtendMock.get.mockReturnValueOnce({ json: vi.fn().mockRejectedValue(new Error('Slow Crash')) });
    kyExtendMock.get.mockReturnValueOnce({ json: vi.fn().mockResolvedValue({ ok: true }) });
    
    const start = Date.now();
    const p1 = manager.fetch('http://slow-crash.com', 'SlowProv');
    const p2 = manager.fetch('http://slow-crash.com/2', 'SlowProv');
    
    await expect(p1).rejects.toThrow('Slow Crash');
    await p2;
    const end = Date.now();
    
    // Auch wenn p1 fehlschlägt, MUSS das Throttling (100ms) für p2 greifen
    expect(end - start).toBeGreaterThanOrEqual(95);
  });

  it('sollte 403 und 404 Fehler speziell behandeln und loggen (Zeile 55)', async () => {
    const manager = new RequestManager(config);
    const kyExtendMock = ky.extend();
    const error404 = new Error('Not Found');
    error404.response = { status: 404 };
    
    kyExtendMock.get.mockReturnValue({
      json: vi.fn().mockRejectedValue(error404)
    });
    
    await expect(manager.fetch('http://missing.com', 'FastProv')).rejects.toThrow('Not Found');
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('[RequestManager] Skipping http://missing.com (Status: 404)'));
    
    const error403 = new Error('Forbidden');
    error403.response = { status: 403 };
    kyExtendMock.get.mockReturnValue({
      json: vi.fn().mockRejectedValue(error403)
    });
    await expect(manager.fetch('http://forbidden.com', 'FastProv')).rejects.toThrow('Forbidden');
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('[RequestManager] Skipping http://forbidden.com (Status: 403)'));
  });

  it('sollte unhandled rejections in der Queue abfangen (Zeile 79)', async () => {
    const manager = new RequestManager(config); // SlowProv has delayMs > 0
    const kyExtendMock = ky.extend();
    
    kyExtendMock.get.mockReturnValue({
      json: vi.fn().mockResolvedValue({ ok: true })
    });
    
    // Wir mocken setTimeout so dass es explodiert
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = () => { throw new Error('Queue Error'); };
    
    // Die Promise der fetch-Methode wird resolven (da execute() klappt), 
    // aber DANACH explodiert setTimeout in der Queue und das wird vom Queue-Catch abgefangen.
    await manager.fetch('http://queue.com', 'SlowProv');
    
    // Wiederherstellen
    global.setTimeout = originalSetTimeout;
    
    // Kurz warten, bis der microtask für das catch ausgeführt wurde
    await new Promise(r => originalSetTimeout(r, 10));
    
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[RequestManager Queue Error] Queue Error'));
  });

  it('sollte den Cache korrekt anhand des cacheKeys anstatt der reinen URL setzen', async () => {
    const manager = new RequestManager(config);
    const kyExtendMock = ky.extend();
    
    // Wir mocken zwei unterschiedliche Responses
    kyExtendMock.get.mockReturnValueOnce({ json: vi.fn().mockResolvedValue({ id: 'req1' }) });
    kyExtendMock.get.mockReturnValueOnce({ json: vi.fn().mockResolvedValue({ id: 'req2' }) });
    
    // Startet zwei Anfragen mit unterschiedlichen searchParams an dieselbe URL
    const params1 = new URLSearchParams({ param: 'A' });
    const params2 = new URLSearchParams({ param: 'B' });
    
    const p1 = manager.fetch('http://cache-bug.com', 'FastProv', { searchParams: params1 });
    const p2 = manager.fetch('http://cache-bug.com', 'FastProv', { searchParams: params2 });
    
    const [res1, res2] = await Promise.all([p1, p2]);
    
    // Beide Anfragen sollten unterschiedlich sein, da der CacheKey unterschiedlich ist
    expect(res1).toEqual({ id: 'req1' });
    expect(res2).toEqual({ id: 'req2' });
    
    // Cache Hit Test: Die exakt selbe URL + Params sollte aus dem Cache kommen (kein 3. Call)
    kyExtendMock.get.mockReturnValueOnce({ json: vi.fn().mockResolvedValue({ id: 'req3' }) });
    const p3 = manager.fetch('http://cache-bug.com', 'FastProv', { searchParams: params1 });
    const res3 = await p3;
    expect(res3).toEqual({ id: 'req1' });
    
    // kyExtendMock.get sollte nur 2x gerufen worden sein (für req1 und req2)
    expect(kyExtendMock.get).toHaveBeenCalledTimes(2);
  });
});
