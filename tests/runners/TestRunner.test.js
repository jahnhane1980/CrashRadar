import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestRunner } from '../../src/runners/TestRunner.js';
import { StandardRunner } from '../../src/runners/StandardRunner.js';

describe('TestRunner', () => {
  let runner;

  beforeEach(() => {
    runner = new TestRunner();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('run', () => {
    it('should print test mode log and call super.run', async () => {
      const superRunMock = vi.spyOn(StandardRunner.prototype, 'run').mockResolvedValue('ok');
      
      const result = await runner.run();
      
      expect(console.log).toHaveBeenCalledWith('\n[INFO] RUNNING IN TEST MODE (--test)');
      expect(superRunMock).toHaveBeenCalled();
      expect(result).toBe('ok');
    });
  });

  describe('getDatabaseUrl', () => {
    it('should return DATABASE_URL_TEST if set', () => {
      process.env.DATABASE_URL_TEST = 'mysql://test_dummy';
      
      const url = runner.getDatabaseUrl();
      
      expect(url).toBe('mysql://test_dummy');
      expect(console.log).toHaveBeenCalledWith('[INFO] Verwende TEST Datenbank:', 'mysql://test_dummy');
    });

    it('should fallback to DATABASE_URL if DATABASE_URL_TEST is not set', () => {
      delete process.env.DATABASE_URL_TEST;
      process.env.DATABASE_URL = 'mysql://dummy';
      
      const url = runner.getDatabaseUrl();
      
      expect(url).toBe('mysql://dummy');
      expect(console.warn).toHaveBeenCalledWith('[Warn] DATABASE_URL_TEST nicht gefunden. Verwende reguläre DATABASE_URL als Fallback!');
    });
  });

  describe('loadFetcherConfig', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-24T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should set globalStartDate to 3 days ago', () => {
      vi.spyOn(StandardRunner.prototype, 'loadFetcherConfig').mockReturnValue({});
      
      const config = runner.loadFetcherConfig();
      
      // 3 days before 2026-06-24 is 2026-06-21
      expect(config.globalStartDate).toBe('2026-06-21');
    });

    it('should update maxLimit if provider has pagination and maxLimit > 5', () => {
      vi.spyOn(StandardRunner.prototype, 'loadFetcherConfig').mockReturnValue({
        providers: {
          testProvider: {
            pagination: { maxLimit: 10 }
          }
        }
      });
      
      const config = runner.loadFetcherConfig();
      
      expect(config.providers.testProvider.pagination.maxLimit).toBe(5);
    });

    it('should keep maxLimit if provider has pagination and maxLimit <= 5', () => {
      vi.spyOn(StandardRunner.prototype, 'loadFetcherConfig').mockReturnValue({
        providers: {
          testProvider: {
            pagination: { maxLimit: 3 }
          }
        }
      });
      
      const config = runner.loadFetcherConfig();
      
      expect(config.providers.testProvider.pagination.maxLimit).toBe(3);
    });

    it('should not throw if provider pagination is missing', () => {
      vi.spyOn(StandardRunner.prototype, 'loadFetcherConfig').mockReturnValue({
        providers: {
          testProvider: {}
        }
      });
      
      const config = runner.loadFetcherConfig();
      
      expect(config.providers.testProvider).toEqual({});
    });

    it('should update provider overrideStartDate', () => {
      vi.spyOn(StandardRunner.prototype, 'loadFetcherConfig').mockReturnValue({
        providers: {
          testProvider: { overrideStartDate: '2026-01-01' }
        }
      });
      
      const config = runner.loadFetcherConfig();
      
      expect(config.providers.testProvider.overrideStartDate).toBe('2026-06-21');
    });

    it('should update task overrideStartDate', () => {
      vi.spyOn(StandardRunner.prototype, 'loadFetcherConfig').mockReturnValue({
        tasks: [
          { overrideStartDate: '2026-01-01' },
          { name: 'no-override' }
        ]
      });
      
      const config = runner.loadFetcherConfig();
      
      expect(config.tasks[0].overrideStartDate).toBe('2026-06-21');
      expect(config.tasks[1].overrideStartDate).toBeUndefined();
    });
  });
});
