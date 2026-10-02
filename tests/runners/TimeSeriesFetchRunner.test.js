import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeSeriesFetchRunner, DataFetchRunner } from '../../src/runners/TimeSeriesFetchRunner.js';
import { StandardRunner } from '../../src/runners/StandardRunner.js';
import { TestRunner } from '../../src/runners/TestRunner.js';
import { Logger } from '../../src/core/Logger.js';
import { ErrorRegistry } from '../../src/core/ErrorRegistry.js';

describe('TimeSeriesFetchRunner', () => {
  let mockStorage;
  let mockFetcher;
  let mockErrorRegistry;
  let mockRunner;

  beforeEach(() => {
    vi.spyOn(Logger, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger, 'error').mockImplementation(() => {});

    mockStorage = { close: vi.fn().mockResolvedValue() };
    mockFetcher = { runAllTasks: vi.fn().mockResolvedValue() };
    mockErrorRegistry = {
      hasErrors: vi.fn().mockReturnValue(false),
      hasWarnings: vi.fn().mockReturnValue(false),
      addError: vi.fn(),
      addWarning: vi.fn(),
      getSummary: vi.fn().mockReturnValue('')
    };
    mockRunner = { run: vi.fn().mockResolvedValue(), cleanup: vi.fn().mockResolvedValue() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('führt Standard-Lauf aus und startet den konfigurierten Runner', async () => {
    const runner = new TimeSeriesFetchRunner(
      { test: false },
      {
        dbUrl: 'mysql://test:test@localhost/crashradar',
        config: { globalStartDate: '2020-01-01' },
        storage: mockStorage,
        fetcher: mockFetcher,
        errorRegistry: mockErrorRegistry,
        runner: mockRunner
      }
    );

    await runner.run();

    expect(mockRunner.run).toHaveBeenCalled();
  });

  it('wendet TestConfigOverrides an wenn options.test auf true gesetzt ist', async () => {
    const overrideSpy = vi.spyOn(TestRunner, 'applyTestConfigOverrides');
    const mockConfig = { globalStartDate: '2015-01-01', providers: {}, tasks: [] };

    const runner = new TimeSeriesFetchRunner(
      { test: true },
      {
        dbUrl: 'mysql://test:test@localhost/crashradar_test',
        config: mockConfig,
        storage: mockStorage,
        fetcher: mockFetcher,
        errorRegistry: mockErrorRegistry,
        runner: mockRunner
      }
    );

    await runner.run();

    expect(overrideSpy).toHaveBeenCalledWith(mockConfig);
    expect(mockRunner.run).toHaveBeenCalled();
  });

  it('wirft einen Fehler wenn DATABASE_URL fehlt', async () => {
    const origUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_TEST;

    const runner = new TimeSeriesFetchRunner({ test: false });

    await expect(runner.run()).rejects.toThrow('Missing DATABASE_URL');

    process.env.DATABASE_URL = origUrl;
  });

  it('ruft cleanup() auf dem aktiven Runner auf', async () => {
    const runner = new TimeSeriesFetchRunner(
      { test: false },
      {
        dbUrl: 'mysql://test:test@localhost/crashradar',
        config: { globalStartDate: '2020-01-01' },
        runner: mockRunner
      }
    );

    await runner.run();
    await runner.cleanup();

    expect(mockRunner.cleanup).toHaveBeenCalled();
  });

  it('unterstützt den Alias DataFetchRunner', () => {
    expect(DataFetchRunner).toBe(TimeSeriesFetchRunner);
  });

  it('filtert Tasks strikt nach task.group wenn options.group übergeben wird', async () => {
    const mockConfig = {
      globalStartDate: '2020-01-01',
      tasks: [
        { id: 'task1', group: 'intraday_m5' },
        { id: 'task2', group: 'daily_eod' },
        { id: 'task3', group: 'intraday_m5' }
      ]
    };
    mockStorage.acquireLock = vi.fn().mockResolvedValue(true);
    mockStorage.releaseLock = vi.fn().mockResolvedValue();

    const runner = new TimeSeriesFetchRunner(
      { group: 'intraday_m5' },
      {
        dbUrl: 'mysql://test:test@localhost/crashradar',
        config: mockConfig,
        storage: mockStorage,
        fetcher: mockFetcher,
        errorRegistry: mockErrorRegistry,
        runner: mockRunner
      }
    );

    await runner.run();

    expect(mockConfig.tasks).toHaveLength(2);
    expect(mockConfig.tasks.every(t => t.group === 'intraday_m5')).toBe(true);
  });

  it('schließt Tasks mit group: "intraday_m5" aus wenn options.group NICHT übergeben wird', async () => {
    const mockConfig = {
      globalStartDate: '2020-01-01',
      tasks: [
        { id: 'task1', group: 'intraday_m5' },
        { id: 'task2', group: 'daily_eod' },
        { id: 'task3' }
      ]
    };

    const runner = new TimeSeriesFetchRunner(
      {},
      {
        dbUrl: 'mysql://test:test@localhost/crashradar',
        config: mockConfig,
        storage: mockStorage,
        fetcher: mockFetcher,
        errorRegistry: mockErrorRegistry,
        runner: mockRunner
      }
    );

    await runner.run();

    expect(mockConfig.tasks).toHaveLength(2);
    expect(mockConfig.tasks.find(t => t.id === 'task1')).toBeUndefined();
    expect(mockConfig.tasks.find(t => t.id === 'task2')).toBeDefined();
    expect(mockConfig.tasks.find(t => t.id === 'task3')).toBeDefined();
  });

  it('holt Mutex-Lock für intraday_m5, bricht ab wenn Lock aktiv ist (ohne Exception)', async () => {
    mockStorage.acquireLock = vi.fn().mockResolvedValue(false);
    mockStorage.releaseLock = vi.fn().mockResolvedValue();
    const warnSpy = vi.spyOn(Logger, 'warn');

    const runner = new TimeSeriesFetchRunner(
      { group: 'intraday_m5' },
      {
        dbUrl: 'mysql://test:test@localhost/crashradar',
        config: { globalStartDate: '2020-01-01', tasks: [] },
        storage: mockStorage,
        fetcher: mockFetcher,
        errorRegistry: mockErrorRegistry,
        runner: mockRunner
      }
    );

    await runner.run();

    expect(mockStorage.acquireLock).toHaveBeenCalledWith('m5_sync_lock', 600);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('m5_sync_lock is active - skipping execution'));
    expect(mockRunner.run).not.toHaveBeenCalled();
    expect(mockStorage.releaseLock).not.toHaveBeenCalled();
  });

  it('holt Mutex-Lock für intraday_m5 und gibt Lock im finally-Block frei', async () => {
    mockStorage.acquireLock = vi.fn().mockResolvedValue(true);
    mockStorage.releaseLock = vi.fn().mockResolvedValue();

    const runner = new TimeSeriesFetchRunner(
      { group: 'intraday_m5' },
      {
        dbUrl: 'mysql://test:test@localhost/crashradar',
        config: { globalStartDate: '2020-01-01', tasks: [] },
        storage: mockStorage,
        fetcher: mockFetcher,
        errorRegistry: mockErrorRegistry,
        runner: mockRunner
      }
    );

    await runner.run();

    expect(mockStorage.acquireLock).toHaveBeenCalledWith('m5_sync_lock', 600);
    expect(mockRunner.run).toHaveBeenCalled();
    expect(mockStorage.releaseLock).toHaveBeenCalledWith('m5_sync_lock');
  });

  it('gibt Lock für intraday_m5 auch dann frei wenn Runner fehlschlägt', async () => {
    mockStorage.acquireLock = vi.fn().mockResolvedValue(true);
    mockStorage.releaseLock = vi.fn().mockResolvedValue();
    mockRunner.run.mockRejectedValue(new Error('Runner Error'));

    const runner = new TimeSeriesFetchRunner(
      { group: 'intraday_m5' },
      {
        dbUrl: 'mysql://test:test@localhost/crashradar',
        config: { globalStartDate: '2020-01-01', tasks: [] },
        storage: mockStorage,
        fetcher: mockFetcher,
        errorRegistry: mockErrorRegistry,
        runner: mockRunner
      }
    );

    await expect(runner.run()).rejects.toThrow('Runner Error');

    expect(mockStorage.acquireLock).toHaveBeenCalledWith('m5_sync_lock', 600);
    expect(mockStorage.releaseLock).toHaveBeenCalledWith('m5_sync_lock');
  });

  it('startet nach erfolgreichem acquireLock einen Heartbeat (Intervall: 120s), der renewLock aufruft und im finally-Block bereinigt wird', async () => {
    vi.useFakeTimers();
    try {
      mockStorage.acquireLock = vi.fn().mockResolvedValue(true);
      mockStorage.renewLock = vi.fn().mockResolvedValue(true);
      mockStorage.releaseLock = vi.fn().mockResolvedValue();

      let resolveRunner;
      const runnerPromise = new Promise(resolve => {
        resolveRunner = resolve;
      });
      mockRunner.run = vi.fn().mockReturnValue(runnerPromise);

      const runner = new TimeSeriesFetchRunner(
        { group: 'intraday_m5' },
        {
          dbUrl: 'mysql://test:test@localhost/crashradar',
          config: { globalStartDate: '2020-01-01', tasks: [] },
          storage: mockStorage,
          fetcher: mockFetcher,
          errorRegistry: mockErrorRegistry,
          runner: mockRunner
        }
      );

      const runPromise = runner.run();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockStorage.acquireLock).toHaveBeenCalledWith('m5_sync_lock', 600);
      expect(mockStorage.renewLock).not.toHaveBeenCalled();

      // Vorlauf 120s
      await vi.advanceTimersByTimeAsync(120000);
      expect(mockStorage.renewLock).toHaveBeenCalledTimes(1);
      expect(mockStorage.renewLock).toHaveBeenCalledWith('m5_sync_lock', 600);

      // Vorlauf weitere 120s (240s gesamt)
      await vi.advanceTimersByTimeAsync(120000);
      expect(mockStorage.renewLock).toHaveBeenCalledTimes(2);

      // Beende Runner
      resolveRunner();
      await runPromise;

      expect(mockStorage.releaseLock).toHaveBeenCalledWith('m5_sync_lock');

      // Nach Beendigung darf renewLock nicht mehr aufgerufen werden (Intervall bereinigt)
      mockStorage.renewLock.mockClear();
      await vi.advanceTimersByTimeAsync(240000);
      expect(mockStorage.renewLock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('bereinigt das Heartbeat-Interval im finally-Block auch bei Fehlern', async () => {
    vi.useFakeTimers();
    try {
      mockStorage.acquireLock = vi.fn().mockResolvedValue(true);
      mockStorage.renewLock = vi.fn().mockResolvedValue(true);
      mockStorage.releaseLock = vi.fn().mockResolvedValue();

      let rejectRunner;
      const runnerPromise = new Promise((_, reject) => {
        rejectRunner = reject;
      });
      mockRunner.run = vi.fn().mockReturnValue(runnerPromise);

      const runner = new TimeSeriesFetchRunner(
        { group: 'intraday_m5' },
        {
          dbUrl: 'mysql://test:test@localhost/crashradar',
          config: { globalStartDate: '2020-01-01', tasks: [] },
          storage: mockStorage,
          fetcher: mockFetcher,
          errorRegistry: mockErrorRegistry,
          runner: mockRunner
        }
      );

      const runPromise = runner.run();
      await vi.advanceTimersByTimeAsync(120000);
      expect(mockStorage.renewLock).toHaveBeenCalledTimes(1);

      rejectRunner(new Error('Runner Error'));
      await expect(runPromise).rejects.toThrow('Runner Error');

      expect(mockStorage.releaseLock).toHaveBeenCalledWith('m5_sync_lock');

      mockStorage.renewLock.mockClear();
      await vi.advanceTimersByTimeAsync(240000);
      expect(mockStorage.renewLock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('speichert die Storage-Instanz auf this.storage', async () => {
    const runner = new TimeSeriesFetchRunner(
      { test: false },
      {
        dbUrl: 'mysql://test:test@localhost/crashradar',
        config: { globalStartDate: '2020-01-01' },
        storage: mockStorage,
        fetcher: mockFetcher,
        errorRegistry: mockErrorRegistry,
        runner: mockRunner
      }
    );

    await runner.run();

    expect(runner.storage).toBe(mockStorage);
  });

  it('injiziert die ErrorRegistry in den Logger und sammelt Logger.error() konsistent', async () => {
    vi.restoreAllMocks(); // Spies aufheben, damit Logger und ErrorRegistry real interagieren
    const realErrorRegistry = new ErrorRegistry();
    let runnerCapturedRegistry = null;

    const runner = new TimeSeriesFetchRunner(
      { test: false },
      {
        dbUrl: 'mysql://test:test@localhost/crashradar',
        config: { globalStartDate: '2020-01-01' },
        storage: mockStorage,
        fetcher: mockFetcher,
        errorRegistry: realErrorRegistry,
        runner: {
          run: vi.fn().mockImplementation(async () => {
            runnerCapturedRegistry = Logger.registry;
            Logger.error('[Storage] Connection dropped during task');
          })
        }
      }
    );

    await runner.run();

    expect(runnerCapturedRegistry).toBe(realErrorRegistry);
    expect(realErrorRegistry.hasErrors()).toBe(true);
    expect(realErrorRegistry.getSummary()).toContain('- [Storage] Connection dropped during task');
  });

  it('erstellt eine ErrorRegistry und injiziert sie in den Logger wenn keine dependency übergeben wird', async () => {
    vi.restoreAllMocks();
    let runnerCapturedRegistry = null;

    const runner = new TimeSeriesFetchRunner(
      { test: false },
      {
        dbUrl: 'mysql://test:test@localhost/crashradar',
        config: { globalStartDate: '2020-01-01' },
        storage: mockStorage,
        fetcher: mockFetcher,
        runner: {
          run: vi.fn().mockImplementation(async () => {
            runnerCapturedRegistry = Logger.registry;
            Logger.error('[Fetch] API rate limit exceeded');
          })
        }
      }
    );

    await runner.run();

    expect(runnerCapturedRegistry).toBeDefined();
    expect(runner.errorRegistry).toBe(runnerCapturedRegistry);
    expect(runnerCapturedRegistry.hasErrors()).toBe(true);
    expect(runnerCapturedRegistry.getSummary()).toContain('- [Fetch] API rate limit exceeded');
  });

  describe('expandTemplates', () => {
    it('löst $template-Referenzen gegen ein templates-Wurzelobjekt auf und merged tasks-Spezifika ein', () => {
      const config = {
        templates: {
          fred_series: {
            provider: 'FRED',
            endpoint: '/fred/series/observations',
            params: {
              file_type: 'json'
            }
          }
        },
        tasks: [
          {
            $template: 'fred_series',
            id: 'fred_walcl',
            series_id: 'WALCL'
          },
          {
            id: 'custom_task',
            provider: 'Binance',
            endpoint: '/api/v3/klines'
          }
        ]
      };

      const result = TimeSeriesFetchRunner.expandTemplates(config);

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0]).toEqual({
        provider: 'FRED',
        endpoint: '/fred/series/observations',
        params: {
          file_type: 'json',
          series_id: 'WALCL'
        },
        id: 'fred_walcl',
        series_id: 'WALCL'
      });
      expect(result.tasks[1]).toEqual({
        id: 'custom_task',
        provider: 'Binance',
        endpoint: '/api/v3/klines'
      });
    });

    it('unterstützt explizite params-Verschachtelung und Template-Overrides', () => {
      const config = {
        templates: {
          fred_series: {
            provider: 'FRED',
            endpoint: '/fred/series/observations',
            params: {
              file_type: 'json',
              frequency: 'm'
            }
          }
        },
        tasks: [
          {
            $template: 'fred_series',
            id: 'fred_custom',
            params: {
              series_id: 'CPI',
              frequency: 'd'
            }
          }
        ]
      };

      const result = TimeSeriesFetchRunner.expandTemplates(config);

      expect(result.tasks[0].params).toEqual({
        file_type: 'json',
        frequency: 'd',
        series_id: 'CPI'
      });
      expect(result.tasks[0].series_id).toBe('CPI');
    });

    it('interpoliert Platzhalter im Endpoint wie {ticker}', () => {
      const config = {
        templates: {
          tiingo_daily: {
            provider: 'Tiingo',
            endpoint: '/tiingo/daily/{ticker}/prices',
            params: {},
            resolution: 'daily'
          }
        },
        tasks: [
          {
            $template: 'tiingo_daily',
            id: 'tiingo_spy_daily',
            ticker: 'SPY'
          }
        ]
      };

      const result = TimeSeriesFetchRunner.expandTemplates(config);

      expect(result.tasks[0].endpoint).toBe('/tiingo/daily/SPY/prices');
      expect(result.tasks[0].ticker).toBe('SPY');
      expect(result.tasks[0].provider).toBe('Tiingo');
    });

    it('wirft einen Fehler wenn ein referenziertes Template nicht existiert', () => {
      const config = {
        templates: {},
        tasks: [
          {
            $template: 'non_existent',
            id: 'task_missing'
          }
        ]
      };

      expect(() => TimeSeriesFetchRunner.expandTemplates(config)).toThrow(
        /Template 'non_existent' referenced in task 'task_missing' not found/
      );
    });

    it('expandiert Templates im run()-Zyklus vor der Task-Filterung und Runner-Ausführung', async () => {
      let passedConfig = null;
      const mockRunner = {
        run: vi.fn().mockImplementation(async () => {}),
        cleanup: vi.fn()
      };

      const rawConfig = {
        globalStartDate: '2020-01-01',
        templates: {
          fred_series: {
            provider: 'FRED',
            endpoint: '/fred/series/observations',
            params: { file_type: 'json' }
          }
        },
        tasks: [
          {
            $template: 'fred_series',
            id: 'fred_walcl',
            series_id: 'WALCL'
          }
        ]
      };

      const runner = new TimeSeriesFetchRunner(
        { test: false },
        {
          dbUrl: 'mysql://test:test@localhost/crashradar',
          config: rawConfig,
          storage: mockStorage,
          fetcher: mockFetcher,
          runner: {
            run: vi.fn().mockImplementation(function() {
              passedConfig = runner.activeRunner ? null : null;
            })
          }
        }
      );

      // We spy on runner.expandTemplates
      const expandSpy = vi.spyOn(runner, 'expandTemplates');
      await runner.run();

      expect(expandSpy).toHaveBeenCalled();
      expect(rawConfig.tasks[0].provider).toBe('FRED');
      expect(rawConfig.tasks[0].params.series_id).toBe('WALCL');
    });

    it('lädt Database-Fetcher-Config.json und expandiert alle konsolidierten FRED-Tasks erfolgreich', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const raw = fs.readFileSync(path.resolve('config/Database-Fetcher-Config.json'), 'utf8');
      const cfg = JSON.parse(raw);

      expect(cfg.templates).toBeDefined();
      expect(cfg.templates.fred_series).toBeDefined();

      const fredRawTasks = cfg.tasks.filter(t => t.$template === 'fred_series');
      expect(fredRawTasks.length).toBeGreaterThanOrEqual(60);

      const expanded = TimeSeriesFetchRunner.expandTemplates(cfg);
      const expandedFredTasks = expanded.tasks.filter(t => t.id && t.id.startsWith('fred_'));
      expect(expandedFredTasks.length).toBeGreaterThanOrEqual(60);

      for (const t of expandedFredTasks) {
        expect(t.provider).toBe('FRED');
        expect(t.endpoint).toBe('/fred/series/observations');
        expect(t.params).toBeDefined();
        expect(t.params.file_type).toBe('json');
        expect(typeof t.params.series_id).toBe('string');
        expect(t.params.series_id.length).toBeGreaterThan(0);
        expect(t.series_id).toBe(t.params.series_id);
      }
    });
  });
});
