import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCLI } from '../index.js';
import { ScenarioChecklistService } from '../src/services/ScenarioChecklistService.js';
import { Logger } from '../src/core/Logger.js';

describe('CLI --check-scenario', () => {
  beforeEach(() => {
    vi.spyOn(Logger, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('beendet sauber, wenn am aktuellen Tag kein Event ansteht', async () => {
    vi.spyOn(ScenarioChecklistService.prototype, 'getEventForDate').mockReturnValue(null);
    const loggerInfoSpy = vi.spyOn(Logger, 'info');

    await runCLI(['node', 'index.js', '--check-scenario']);

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Kein Makro-Event für heute'));
  });

  it('beendet sauber, wenn das Event heute bereits gemeldet wurde', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    vi.spyOn(ScenarioChecklistService.prototype, 'getEventForDate').mockReturnValue({
      id: 'test_event',
      title: 'Test Event',
      date: todayStr
    });

    vi.spyOn(JSON, 'parse').mockReturnValue({
      scenarioEvents: {
        test_event: todayStr
      }
    });

    const loggerInfoSpy = vi.spyOn(Logger, 'info');

    await runCLI(['node', 'index.js', '--check-scenario']);

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('bereits gemeldet'));
  });
});
