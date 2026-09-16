import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { PortfolioStrategyRunner } from '../../src/runners/PortfolioStrategyRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_TMP_DIR = path.resolve(__dirname, '../.tmp');
const TEST_SNAPSHOT_PATH = path.resolve(TEST_TMP_DIR, 'daily_intelligence_test.json');

describe('PortfolioStrategyRunner', () => {
  const buildMockTimeline = () => [
    {
      date: '2026-09-13',
      assets: { SPY: 560, GLD: 250, VIX: 16.5 },
      macroGroups: {
        FinancialConditions: { ChicagoFedIndex: -0.55 },
        NetLiquidity: { WALCL: 7000, TGA: 500, RRPONTSYD: 500 },
        Leading: { MarginDebt: 550000 }
      }
    }
  ];

  beforeEach(() => {
    if (!fs.existsSync(TEST_TMP_DIR)) {
      fs.mkdirSync(TEST_TMP_DIR, { recursive: true });
    }
    if (fs.existsSync(TEST_SNAPSHOT_PATH)) {
      try { fs.unlinkSync(TEST_SNAPSHOT_PATH); } catch (e) {}
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_SNAPSHOT_PATH)) {
      try { fs.unlinkSync(TEST_SNAPSHOT_PATH); } catch (e) {}
    }
  });

  afterAll(() => {
    if (fs.existsSync(TEST_TMP_DIR)) {
      try { fs.rmSync(TEST_TMP_DIR, { recursive: true, force: true }); } catch (e) {}
    }
  });

  it('should run successfully with injected timeline and write daily_intelligence snapshot', async () => {
    const runner = new PortfolioStrategyRunner({
      test: true,
      snapshotPath: TEST_SNAPSHOT_PATH
    }, {
      timeline: buildMockTimeline()
    });

    const result = await runner.run();

    expect(result).toBeDefined();
    expect(result.evalResults).toBeDefined();
    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.schema_version).toBe('2.1.0');
    expect(result.snapshot.snapshot_date).toBe('2026-09-13');
    expect(result.snapshot.strategies.GOLD_SPY).toBeDefined();

    // Datei muss auf der Festplatte liegen
    expect(fs.existsSync(TEST_SNAPSHOT_PATH)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(TEST_SNAPSHOT_PATH, 'utf8'));
    expect(saved.schema_version).toBe('2.1.0');
    expect(saved.strategies.GOLD_SPY.status).toBe('NORMAL_DCA');
  });

  it('should throw error if timeline is empty', async () => {
    const runner = new PortfolioStrategyRunner({
      test: true,
      snapshotPath: TEST_SNAPSHOT_PATH
    }, {
      timeline: []
    });

    await expect(runner.run()).rejects.toThrow('Keine Timeline-Daten');
  });

  it('should safely call cleanup()', () => {
    const mockExpert = { close: () => {} };
    const runner = new PortfolioStrategyRunner({}, { expert: mockExpert });
    expect(() => runner.cleanup()).not.toThrow();
  });

  it('should invoke notificationService when provided', async () => {
    const mockNotificationService = {
      dispatchStrategyAlerts: vi.fn().mockResolvedValue([
        { strategyId: 'GOLD_SPY', status: 'NORMAL_DCA' }
      ])
    };

    const runner = new PortfolioStrategyRunner({
      test: true,
      snapshotPath: TEST_SNAPSHOT_PATH,
      sendNtfy: true
    }, {
      timeline: buildMockTimeline(),
      notificationService: mockNotificationService
    });

    const result = await runner.run();
    expect(result.dispatchedAlerts).toBeDefined();
    expect(result.dispatchedAlerts.length).toBe(1);
    expect(mockNotificationService.dispatchStrategyAlerts).toHaveBeenCalledWith(
      expect.any(Object),
      { forceSend: true }
    );
  });
});

