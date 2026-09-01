import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeSeriesFetchRunner, DataFetchRunner } from '../../src/runners/TimeSeriesFetchRunner.js';
import { StandardRunner } from '../../src/runners/StandardRunner.js';
import { TestRunner } from '../../src/runners/TestRunner.js';
import { Logger } from '../../src/core/Logger.js';

describe('TimeSeriesFetchRunner', () => {
  let mockStorage;
  let mockFetcher;
  let mockMwBuilder;
  let mockErrorRegistry;
  let mockRunner;

  beforeEach(() => {
    vi.spyOn(Logger, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger, 'error').mockImplementation(() => {});

    mockStorage = { close: vi.fn().mockResolvedValue() };
    mockFetcher = { runAllTasks: vi.fn().mockResolvedValue() };
    mockMwBuilder = { build: vi.fn().mockResolvedValue(), close: vi.fn().mockResolvedValue() };
    mockErrorRegistry = { hasErrors: vi.fn().mockReturnValue(false) };
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
        maturityWallBuilder: mockMwBuilder,
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
        maturityWallBuilder: mockMwBuilder,
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
});
