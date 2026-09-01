import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCLI } from '../index.js';
import { TimeSeriesFetchRunner } from '../src/runners/TimeSeriesFetchRunner.js';
import { IndicatorAnalysisRunner } from '../src/runners/IndicatorAnalysisRunner.js';
import { MacroScorecardRunner } from '../src/runners/MacroScorecardRunner.js';
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

  it('startet im Indicator-Modus mit IndicatorAnalysisRunner (-c)', async () => {
    const runSpy = vi.spyOn(IndicatorAnalysisRunner.prototype, 'run').mockResolvedValue();

    await runCLI(['node', 'index.js', '-c']);

    expect(runSpy).toHaveBeenCalled();
  });

  it('startet im Scenario-Modus mit MacroScorecardRunner (-s)', async () => {
    const runSpy = vi.spyOn(MacroScorecardRunner.prototype, 'run').mockResolvedValue();

    await runCLI(['node', 'index.js', '-s']);

    expect(runSpy).toHaveBeenCalled();
  });

  it('reicht Fehler aus dem Runner weiter', async () => {
    vi.spyOn(TimeSeriesFetchRunner.prototype, 'run').mockRejectedValue(new Error('Runner Failure'));

    await expect(runCLI(['node', 'index.js'])).rejects.toThrow('Runner Failure');
  });
});
