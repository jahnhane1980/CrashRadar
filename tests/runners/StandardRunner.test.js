import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StandardRunner } from '../../src/runners/StandardRunner.js';
import { Logger } from '../../src/core/Logger.js';

describe('StandardRunner', () => {
  let mockStorage;
  let mockFetcher;
  let mockMwBuilder;
  let mockErrorRegistry;
  let mockNtfyService;
  let runner;

  beforeEach(() => {
    mockStorage = { close: vi.fn() };
    mockFetcher = { runAllTasks: vi.fn().mockResolvedValue() };
    mockMwBuilder = { build: vi.fn().mockResolvedValue(), close: vi.fn().mockResolvedValue() };
    mockErrorRegistry = { hasErrors: vi.fn().mockReturnValue(false), getSummary: vi.fn().mockReturnValue('Summary') };
    mockNtfyService = { send: vi.fn().mockResolvedValue() };
    
    runner = new StandardRunner({
      config: { globalStartDate: '2020-01-01' },
      storage: mockStorage,
      fetcher: mockFetcher,
      maturityWallBuilder: mockMwBuilder,
      errorRegistry: mockErrorRegistry,
      ntfyService: mockNtfyService
    });

    vi.spyOn(Logger, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger, 'error').mockImplementation(() => {});
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
      expect(mockNtfyService.send).not.toHaveBeenCalled(); // No errors
      expect(mockStorage.close).toHaveBeenCalled();
    });

    it('should send Ntfy alert if ErrorRegistry has errors', async () => {
      mockErrorRegistry.hasErrors.mockReturnValue(true);
      await runner.run();
      expect(mockNtfyService.send).toHaveBeenCalledWith('CrashRadar ETL Fehler', 'Summary', 'high', 'warning');
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

      expect(Logger.error).toHaveBeenCalledWith('[Fatal Error] Execution failed:', 'Test Error');
      expect(mockNtfyService.send).toHaveBeenCalledWith('CrashRadar FATAL ERROR', 'Test Error', 'urgent', 'skull');
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockStorage.close).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should close db and nullify storage', async () => {
      await runner.cleanup();
      
      expect(mockStorage.close).toHaveBeenCalled();
      expect(runner.storage).toBeNull();
      expect(Logger.info).toHaveBeenCalledWith('Database connection closed.');
    });

    it('should do nothing if storage is null', async () => {
      runner.storage = null;
      await runner.cleanup(); // Should not throw
      expect(runner.storage).toBeNull();
    });
  });
});
