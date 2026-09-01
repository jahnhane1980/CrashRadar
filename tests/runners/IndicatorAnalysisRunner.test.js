import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IndicatorAnalysisRunner } from '../../src/runners/IndicatorAnalysisRunner.js';
import { Logger } from '../../src/core/Logger.js';
import fs from 'fs';

describe('IndicatorAnalysisRunner', () => {
  let mockExpert;
  let mockIndicatorEngine;
  let mockNtfyService;
  let mockMacroIndicator;
  let mockScenarioService;

  beforeEach(() => {
    vi.spyOn(Logger, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger, 'error').mockImplementation(() => {});
    vi.spyOn(Logger, 'hasIssues').mockReturnValue(false);

    mockExpert = {
      getDailyGroupedData: vi.fn().mockResolvedValue([
        {
          date: '2026-09-01',
          assets: { SPY: 550, QQQ: 480, BTC: 65000 },
          macroGroups: {}
        }
      ]),
      close: vi.fn().mockResolvedValue()
    };

    mockIndicatorEngine = {
      run: vi.fn(),
      getAlerts: vi.fn().mockReturnValue({
        notifications: [
          { title: 'Test Alert', message: 'Test Msg', priority: 'high', tags: 'warning' }
        ],
        updatedHistory: { test_alert: 12345 }
      }),
      getDailyStatusReport: vi.fn().mockReturnValue({
        title: 'Daily Status',
        message: 'All good',
        priority: 'default',
        tags: 'bar_chart'
      })
    };

    mockNtfyService = {
      send: vi.fn().mockResolvedValue()
    };

    mockMacroIndicator = {
      evaluate: vi.fn().mockReturnValue({
        value: '15.5',
        status: 'NORMAL',
        message: 'Macro Risk Normal'
      })
    };

    mockScenarioService = {
      getEventForDate: vi.fn().mockReturnValue(null),
      evaluate: vi.fn()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('führt IndicatorEngine.run aus und überspringt Ntfy wenn kein NTFY_TOPIC gesetzt ist', async () => {
    delete process.env.NTFY_TOPIC;

    const runner = new IndicatorAnalysisRunner(
      {},
      {
        expert: mockExpert,
        indicatorEngine: mockIndicatorEngine,
        macroIndicator: mockMacroIndicator,
        scenarioService: mockScenarioService
      }
    );

    await runner.run();

    expect(mockExpert.getDailyGroupedData).toHaveBeenCalledWith('2015-01-01');
    expect(mockIndicatorEngine.run).toHaveBeenCalled();
    expect(mockNtfyService.send).not.toHaveBeenCalled();
    expect(mockExpert.close).toHaveBeenCalled();
  });

  it('sendet Ntfy Alarme, Daily Report und speichert History wenn NTFY_TOPIC gesetzt ist', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({}));
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    const runner = new IndicatorAnalysisRunner(
      {},
      {
        expert: mockExpert,
        indicatorEngine: mockIndicatorEngine,
        macroIndicator: mockMacroIndicator,
        scenarioService: mockScenarioService,
        ntfyService: mockNtfyService,
        ntfyTopic: 'test-topic'
      }
    );

    await runner.run();

    expect(mockIndicatorEngine.run).toHaveBeenCalled();
    expect(mockNtfyService.send).toHaveBeenCalledWith('Test Alert', 'Test Msg', 'high', 'warning');
    expect(mockNtfyService.send).toHaveBeenCalledWith('Daily Status', 'All good', 'default', 'bar_chart');
    expect(writeSpy).toHaveBeenCalled();
    expect(mockExpert.close).toHaveBeenCalled();
  });

  it('wertet Makro-Szenario Scorecard aus und sendet sie falls aktiv', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ scenarioEvents: {} }));
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    mockScenarioService.getEventForDate.mockReturnValue({
      id: 'jolts_july',
      title: 'US JOLTS Report (Berichtsmonat: Juli)'
    });
    mockScenarioService.evaluate.mockReturnValue({
      shouldNotify: true,
      title: 'SEPTEMBER 2026: GOLDILOCKS-SCORECARD',
      message: 'Goldilocks details',
      priority: 'default',
      tags: 'trophy'
    });

    const runner = new IndicatorAnalysisRunner(
      {},
      {
        expert: mockExpert,
        indicatorEngine: mockIndicatorEngine,
        macroIndicator: mockMacroIndicator,
        scenarioService: mockScenarioService,
        ntfyService: mockNtfyService,
        ntfyTopic: 'test-topic'
      }
    );

    await runner.run();

    expect(mockNtfyService.send).toHaveBeenCalledWith(
      'SEPTEMBER 2026: GOLDILOCKS-SCORECARD',
      'Goldilocks details',
      'default',
      'trophy'
    );
  });

  it('sendet System-Health Report wenn Logger Probleme festgestellt hat', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({}));
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    vi.spyOn(Logger, 'hasIssues').mockReturnValue(true);
    vi.spyOn(Logger, 'getSummary').mockReturnValue('1 Warnung');

    const runner = new IndicatorAnalysisRunner(
      {},
      {
        expert: mockExpert,
        indicatorEngine: mockIndicatorEngine,
        macroIndicator: mockMacroIndicator,
        scenarioService: mockScenarioService,
        ntfyService: mockNtfyService,
        ntfyTopic: 'test-topic'
      }
    );

    await runner.run();

    expect(mockNtfyService.send).toHaveBeenCalledWith(
      'CrashRadar System-Health Report',
      '1 Warnung',
      'high',
      'warning'
    );
  });

  it('wirft einen Fehler und ruft cleanup() auf wenn DATABASE_URL fehlt', async () => {
    const origUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_TEST;

    const runner = new IndicatorAnalysisRunner({});

    await expect(runner.run()).rejects.toThrow('Missing DATABASE_URL');

    process.env.DATABASE_URL = origUrl;
  });
});
