import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { StandardRunner } from '../../src/runners/StandardRunner.js';
import { Fetcher } from '../../src/services/Fetcher.js';
import { Storage } from '../../src/core/Storage.js';
import { RequestManager } from '../../src/core/RequestManager.js';
import { MaturityWallBuilder } from '../../src/services/MaturityWallBuilder.js';

vi.mock('fs');
vi.mock('../../src/services/Fetcher.js');
vi.mock('../../src/core/Storage.js');
vi.mock('../../src/core/RequestManager.js');
vi.mock('../../src/services/MaturityWallBuilder.js');

describe('StandardRunner', () => {
  let runner;

  beforeEach(() => {
    runner = new StandardRunner();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {});
    process.env.DATABASE_URL = 'mysql://dummy';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getDatabaseUrl', () => {
    it('should return process.env.DATABASE_URL', () => {
      expect(runner.getDatabaseUrl()).toBe('mysql://dummy');
    });
  });

  describe('loadFetcherConfig', () => {
    it('should return parsed config if file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ key: 'value' }));
      
      const config = runner.loadFetcherConfig();
      expect(config).toEqual({ key: 'value' });
    });

    it('should throw an error if config does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      expect(() => runner.loadFetcherConfig()).toThrow('Critical Config not found');
    });
  });

  describe('run', () => {
    it('should run successfully, update maturity wall, and cleanup', async () => {
      vi.spyOn(runner, 'loadFetcherConfig').mockReturnValue({ myConfig: true, globalStartDate: '2020-01-01' });
      
      const mockClose = vi.fn();
      vi.mocked(Storage).mockImplementation(function() {
        return { close: mockClose };
      });
      
      const mockRunAllTasks = vi.fn().mockResolvedValue();
      vi.mocked(Fetcher).mockImplementation(function() {
        return { runAllTasks: mockRunAllTasks };
      });
      
      vi.mocked(RequestManager).mockImplementation(function() {});

      const mockMwBuild = vi.fn().mockResolvedValue();
      const mockMwClose = vi.fn().mockResolvedValue();
      vi.mocked(MaturityWallBuilder).mockImplementation(function() {
        return { build: mockMwBuild, close: mockMwClose };
      });

      await runner.run();

      expect(Storage).toHaveBeenCalledWith({ databaseUrl: 'mysql://dummy' });
      expect(RequestManager).toHaveBeenCalledWith({ myConfig: true, globalStartDate: '2020-01-01' });
      expect(Fetcher).toHaveBeenCalled();
      expect(mockRunAllTasks).toHaveBeenCalled();
      expect(MaturityWallBuilder).toHaveBeenCalledWith('mysql://dummy');
      expect(mockMwBuild).toHaveBeenCalledWith('2020-01-01');
      expect(mockMwClose).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
    });

    it('should catch error, log it, exit, and cleanup', async () => {
      vi.spyOn(runner, 'loadFetcherConfig').mockReturnValue({});
      const mockClose = vi.fn();
      vi.mocked(Storage).mockImplementation(function() {
        return { close: mockClose };
      });
      
      const error = new Error('Test Error');
      const mockRunAllTasks = vi.fn().mockRejectedValue(error);
      vi.mocked(Fetcher).mockImplementation(function() {
        return { runAllTasks: mockRunAllTasks };
      });

      await runner.run();

      expect(console.error).toHaveBeenCalledWith('[Fatal Error] Execution failed:', 'Test Error');
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockClose).toHaveBeenCalled();
    });

    it('should throw if DATABASE_URL is missing', async () => {
      delete process.env.DATABASE_URL;
      await runner.run();
      expect(console.error).toHaveBeenCalledWith('[Fatal Error] Execution failed:', 'Missing DATABASE_URL in environment.');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('cleanup', () => {
    it('should close db and nullify globalStorage', async () => {
      const mockClose = vi.fn();
      runner.globalStorage = { close: mockClose };
      
      await runner.cleanup();
      
      expect(mockClose).toHaveBeenCalled();
      expect(runner.globalStorage).toBeNull();
      expect(console.log).toHaveBeenCalledWith('Database connection closed.');
    });

    it('should do nothing if globalStorage is null', async () => {
      runner.globalStorage = null;
      await runner.cleanup(); // Should not throw
      expect(runner.globalStorage).toBeNull();
    });
  });
});
