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
});
