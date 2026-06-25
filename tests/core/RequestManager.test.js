import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequestManager } from '../../src/core/RequestManager.js';
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    
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

  it('sollte Fehler abfangen und ein leeres Array zurückgeben (z.B. 404, 429 nach allen Retries)', async () => {
    const manager = new RequestManager(config);
    const kyExtendMock = ky.extend();
    kyExtendMock.get.mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error('Not Found'))
    });
    
    const result = await manager.fetch('http://error.com', 'FastProv');
    
    expect(result).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[RequestManager] Final error fetching http://error.com:'), 'Not Found');
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
    
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[RequestManager] Retrying (1) http://retry.com due to Timeout'));
  });

  it('sollte die Promise-Chain nicht abbrechen, wenn eine unerwartete Exception auftritt', async () => {
    const manager = new RequestManager(config);
    const kyExtendMock = ky.extend();
    
    // Simulieren, dass die Methode komplett crasht (throw anstatt Promise-Reject)
    kyExtendMock.get.mockImplementation(() => { throw new Error('Hard Crash') });
    
    const result1 = await manager.fetch('http://crash.com', 'FastProv');
    const result2 = await manager.fetch('http://crash.com/2', 'FastProv');
    
    expect(result1).toEqual([]);
    expect(result2).toEqual([]);
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
