import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StandardRunner } from '../../src/runners/StandardRunner.js';

describe('StandardRunner', () => {
  let mockStorage;
  let mockFetcher;
  let mockMwBuilder;
  let runner;

  beforeEach(() => {
    mockStorage = { close: vi.fn() };
    mockFetcher = { runAllTasks: vi.fn().mockResolvedValue() };
    mockMwBuilder = { build: vi.fn().mockResolvedValue(), close: vi.fn().mockResolvedValue() };
    
    runner = new StandardRunner({
      config: { globalStartDate: '2020-01-01' },
      storage: mockStorage,
      fetcher: mockFetcher,
      maturityWallBuilder: mockMwBuilder
    });

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('run', () => {
    it('should run successfully, update maturity wall, and cleanup', async () => {
      await runner.run();

      expect(mockFetcher.runAllTasks).toHaveBeenCalled();
      expect(mockMwBuilder.build).toHaveBeenCalledWith('2020-01-01');
      expect(mockMwBuilder.close).toHaveBeenCalled();
      expect(mockStorage.close).toHaveBeenCalled();
    });

    it('should fallback to 2015-01-01 if globalStartDate is missing', async () => {
      runner.config = {};
      await runner.run();
      expect(mockMwBuilder.build).toHaveBeenCalledWith('2015-01-01');
    });

    it('should catch error, log it, exit, and cleanup', async () => {
      const error = new Error('Test Error');
      mockFetcher.runAllTasks.mockRejectedValue(error);

      await runner.run();

      expect(console.error).toHaveBeenCalledWith('[Fatal Error] Execution failed:', 'Test Error');
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockStorage.close).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should close db and nullify storage', async () => {
      await runner.cleanup();
      
      expect(mockStorage.close).toHaveBeenCalled();
      expect(runner.storage).toBeNull();
      expect(console.log).toHaveBeenCalledWith('Database connection closed.');
    });

    it('should do nothing if storage is null', async () => {
      runner.storage = null;
      await runner.cleanup(); // Should not throw
      expect(runner.storage).toBeNull();
    });
  });
});
