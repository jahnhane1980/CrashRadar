import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCLI } from '../index.js';
import { TimeSeriesFetchRunner } from '../src/runners/TimeSeriesFetchRunner.js';
import { Logger } from '../src/core/Logger.js';

describe('CLI Entrypoint (index.js)', () => {
  beforeEach(() => {
    vi.spyOn(Logger, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('startet im Standard-Modus mit TimeSeriesFetchRunner', async () => {
    const runSpy = vi.spyOn(TimeSeriesFetchRunner.prototype, 'run').mockResolvedValue();

    await runCLI(['node', 'index.js']);

    expect(runSpy).toHaveBeenCalled();
  });

  it('startet im Test-Modus mit TimeSeriesFetchRunner (-t)', async () => {
    const runSpy = vi.spyOn(TimeSeriesFetchRunner.prototype, 'run').mockResolvedValue();

    await runCLI(['node', 'index.js', '-t']);

    expect(runSpy).toHaveBeenCalled();
  });

  it('übergibt das Profile-Argument korrekt (-p)', async () => {
    const runSpy = vi.spyOn(TimeSeriesFetchRunner.prototype, 'run').mockResolvedValue();

    await runCLI(['node', 'index.js', '-p', 'intraday_m5']);

    expect(runSpy).toHaveBeenCalled();
  });

  it('übergibt das Group-Argument korrekt (--group)', async () => {
    let capturedOptions;
    const runSpy = vi.spyOn(TimeSeriesFetchRunner.prototype, 'run').mockImplementation(function() {
      capturedOptions = this.options;
      return Promise.resolve();
    });

    await runCLI(['node', 'index.js', '--group', 'intraday_m5']);

    expect(runSpy).toHaveBeenCalled();
    expect(capturedOptions.group).toBe('intraday_m5');
  });

  it('behandelt Legacy-Flags (--check-indikator, --check-scenario) fehlerfrei', async () => {
    const runSpy = vi.spyOn(TimeSeriesFetchRunner.prototype, 'run').mockResolvedValue();
    const warnSpy = vi.spyOn(Logger, 'warn');

    await runCLI(['node', 'index.js', '--check-indikator']);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('retired'));
    expect(runSpy).not.toHaveBeenCalled();

    await runCLI(['node', 'index.js', '--check-scenario']);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('retired'));
    expect(runSpy).not.toHaveBeenCalled();
  });

  it('reicht Fehler aus dem Runner weiter', async () => {
    vi.spyOn(TimeSeriesFetchRunner.prototype, 'run').mockRejectedValue(new Error('Runner Failure'));

    await expect(runCLI(['node', 'index.js'])).rejects.toThrow('Runner Failure');
  });

  it('gibt bei SIGINT Lock explizit frei und ruft cleanup() vor process.exit(0) auf', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const mockStorage = { releaseLock: vi.fn().mockResolvedValue() };
    const mockCleanup = vi.fn().mockResolvedValue();

    vi.spyOn(TimeSeriesFetchRunner.prototype, 'run').mockImplementation(function() {
      this.storage = mockStorage;
      this.cleanup = mockCleanup;
      return Promise.resolve();
    });

    await runCLI(['node', 'index.js']);

    const sigintListeners = process.listeners('SIGINT');
    const listener = sigintListeners[sigintListeners.length - 1];

    await listener();

    expect(mockStorage.releaseLock).toHaveBeenCalledWith('m5_sync_lock');
    expect(mockCleanup).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('gibt bei SIGTERM Lock explizit frei und ruft cleanup() vor process.exit(0) auf', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const mockStorage = { releaseLock: vi.fn().mockResolvedValue() };
    const mockCleanup = vi.fn().mockResolvedValue();

    vi.spyOn(TimeSeriesFetchRunner.prototype, 'run').mockImplementation(function() {
      this.storage = mockStorage;
      this.cleanup = mockCleanup;
      return Promise.resolve();
    });

    await runCLI(['node', 'index.js']);

    const sigtermListeners = process.listeners('SIGTERM');
    const listener = sigtermListeners[sigtermListeners.length - 1];

    await listener();

    expect(mockStorage.releaseLock).toHaveBeenCalledWith('m5_sync_lock');
    expect(mockCleanup).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('fängt Fehler bei releaseLock während SIGINT sicher ab und beendet den Prozess mit exit(0)', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const mockStorage = { releaseLock: vi.fn().mockRejectedValue(new Error('DB disconnect')) };
    const mockCleanup = vi.fn().mockResolvedValue();

    vi.spyOn(TimeSeriesFetchRunner.prototype, 'run').mockImplementation(function() {
      this.storage = mockStorage;
      this.cleanup = mockCleanup;
      return Promise.resolve();
    });

    await runCLI(['node', 'index.js']);

    const sigintListeners = process.listeners('SIGINT');
    const listener = sigintListeners[sigintListeners.length - 1];

    await listener();

    expect(mockStorage.releaseLock).toHaveBeenCalledWith('m5_sync_lock');
    expect(mockCleanup).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('behandelt SIGINT gracefully wenn kein activeRunner oder storage aktiv ist', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const sigintListeners = process.listeners('SIGINT');
    const listener = sigintListeners[sigintListeners.length - 1];

    // Reset runner and storage
    const { setActiveRunner, setActiveStorage } = await import('../index.js');
    setActiveRunner(null);
    setActiveStorage(null);

    await listener();

    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
