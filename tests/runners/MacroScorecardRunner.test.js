import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MacroScorecardRunner } from '../../src/runners/MacroScorecardRunner.js';
import { Logger } from '../../src/core/Logger.js';
import fs from 'fs';

describe('MacroScorecardRunner', () => {
  let mockScenarioService;
  let mockStorage;
  let mockRequestManager;
  let mockFetcher;
  let mockErrorRegistry;
  let mockExpert;
  let mockNtfyService;

  beforeEach(() => {
    vi.spyOn(Logger, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger, 'error').mockImplementation(() => {});

    mockScenarioService = {
      getEventForDate: vi.fn(),
      getRequiredTaskIdsForEvent: vi.fn(),
      evaluate: vi.fn()
    };

    mockStorage = { close: vi.fn().mockResolvedValue() };
    mockRequestManager = { fetch: vi.fn() };
    mockFetcher = { runTasksByIds: vi.fn().mockResolvedValue() };
    mockErrorRegistry = { addError: vi.fn() };
    mockExpert = {
      getDailyGroupedData: vi.fn().mockResolvedValue([]),
      close: vi.fn().mockResolvedValue()
    };
    mockNtfyService = { send: vi.fn().mockResolvedValue() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bricht sofort ab, wenn heute kein Event im aktiven Szenario ansteht', async () => {
    mockScenarioService.getEventForDate.mockReturnValue(null);
    const runner = new MacroScorecardRunner(
      { dateOverride: '2026-09-02' },
      { scenarioService: mockScenarioService }
    );

    await runner.run();

    expect(mockFetcher.runTasksByIds).not.toHaveBeenCalled();
    expect(mockExpert.getDailyGroupedData).not.toHaveBeenCalled();
  });

  it('bricht sofort ab, wenn das Event heute bereits gemeldet wurde', async () => {
    mockScenarioService.getEventForDate.mockReturnValue({
      id: 'jolts_july',
      title: 'US JOLTS Report (Berichtsmonat: Juli)',
      date: '2026-09-01'
    });

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      scenarioEvents: {
        jolts_july: '2026-09-01'
      }
    }));

    const runner = new MacroScorecardRunner(
      { dateOverride: '2026-09-01' },
      { scenarioService: mockScenarioService }
    );

    await runner.run();

    expect(mockFetcher.runTasksByIds).not.toHaveBeenCalled();
    expect(mockNtfyService.send).not.toHaveBeenCalled();
  });

  it('führt gezielten Fetch aus und sendet keinen Alert, wenn die Daten isPending sind', async () => {
    mockScenarioService.getEventForDate.mockReturnValue({
      id: 'jolts_july',
      title: 'US JOLTS Report (Berichtsmonat: Juli)',
      date: '2026-09-01',
      targetObservationDate: '2026-07-01'
    });
    mockScenarioService.getRequiredTaskIdsForEvent.mockReturnValue(['fred_jtsjol']);
    mockScenarioService.evaluate.mockReturnValue({
      shouldNotify: false,
      isPending: true
    });

    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const runner = new MacroScorecardRunner(
      { dateOverride: '2026-09-01' },
      {
        scenarioService: mockScenarioService,
        storage: mockStorage,
        fetcher: mockFetcher,
        expert: mockExpert,
        ntfyService: mockNtfyService
      }
    );

    await runner.run();

    expect(mockFetcher.runTasksByIds).toHaveBeenCalledWith(['fred_jtsjol']);
    expect(mockExpert.getDailyGroupedData).toHaveBeenCalled();
    expect(mockNtfyService.send).not.toHaveBeenCalled();
    expect(mockExpert.close).toHaveBeenCalled();
  });

  it('sendet Ntfy Alert und aktualisiert History, wenn frische Daten vorliegen', async () => {
    process.env.NTFY_TOPIC = 'test-topic';
    mockScenarioService.getEventForDate.mockReturnValue({
      id: 'jolts_july',
      title: 'US JOLTS Report (Berichtsmonat: Juli)',
      date: '2026-09-01',
      targetObservationDate: '2026-07-01'
    });
    mockScenarioService.getRequiredTaskIdsForEvent.mockReturnValue(['fred_jtsjol']);
    mockScenarioService.evaluate.mockReturnValue({
      shouldNotify: true,
      title: 'SEPTEMBER 2026: GOLDILOCKS-SCORECARD',
      message: 'Scorecard Details',
      priority: 'default',
      tags: 'trophy'
    });

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ scenarioEvents: {} }));
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    const runner = new MacroScorecardRunner(
      { dateOverride: '2026-09-01' },
      {
        scenarioService: mockScenarioService,
        storage: mockStorage,
        fetcher: mockFetcher,
        expert: mockExpert,
        ntfyService: mockNtfyService
      }
    );

    await runner.run();

    expect(mockNtfyService.send).toHaveBeenCalledWith(
      'SEPTEMBER 2026: GOLDILOCKS-SCORECARD',
      'Scorecard Details',
      'default',
      'trophy'
    );
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('alert_history.json'),
      expect.stringContaining('jolts_july'),
      'utf8'
    );
    expect(mockExpert.close).toHaveBeenCalled();
  });
});
