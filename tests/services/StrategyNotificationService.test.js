import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StrategyNotificationService } from '../../src/services/StrategyNotificationService.js';
import { Logger } from '../../src/core/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_HISTORY_PATH = path.resolve(__dirname, '../../test/strategy_alert_history_test.json');

describe('StrategyNotificationService', () => {
  let originalEnvTopic;

  beforeEach(() => {
    originalEnvTopic = process.env.NTFY_PORTFOLIO_GOLD_SPY;
    if (fs.existsSync(TEST_HISTORY_PATH)) {
      try { fs.unlinkSync(TEST_HISTORY_PATH); } catch (e) {}
    }
  });

  afterEach(() => {
    if (originalEnvTopic !== undefined) {
      process.env.NTFY_PORTFOLIO_GOLD_SPY = originalEnvTopic;
    } else {
      delete process.env.NTFY_PORTFOLIO_GOLD_SPY;
    }
    if (fs.existsSync(TEST_HISTORY_PATH)) {
      try { fs.unlinkSync(TEST_HISTORY_PATH); } catch (e) {}
    }
  });

  describe('renderBar', () => {
    it('should correctly render unicode progress bar for various percentages', () => {
      expect(StrategyNotificationService.renderBar(0, 10)).toBe('░░░░░░░░░░');
      expect(StrategyNotificationService.renderBar(50, 10)).toBe('█████░░░░░');
      expect(StrategyNotificationService.renderBar(75, 10)).toBe('████████░░');
      expect(StrategyNotificationService.renderBar(100, 10)).toBe('██████████');
    });
  });

  describe('formatStrategyMessage', () => {
    it('should format a readable message for NORMAL status', () => {
      const service = new StrategyNotificationService({ historyPath: TEST_HISTORY_PATH });
      const strategyResult = {
        status: 'NORMAL_DCA',
        action: 'DCA_SPY_100',
        reason: 'Normaler Sparplan aktiv.',
        date: '2026-09-13',
        targetAllocationPct: { SPY: 100, CASH: 0 }
      };
      const macroContext = {
        macroStressHub: { status: 'OK', regime: 'NORMAL_EXPANSION' },
        liquidityHub: { status: 'OK', regime: 'EXPANSION' },
        cryptoHub: { status: 'OK', regime: 'BULL_EXPANSION' },
        bottomHub: { status: 'OK', regime: 'NONE' }
      };
      const manifest = { id: 'GOLD_SPY', name: 'Gold-SPY DCA' };

      const msg = service.formatStrategyMessage('GOLD_SPY', strategyResult, macroContext, manifest);

      expect(msg).toContain('Gold-SPY DCA');
      expect(msg).toContain('NORMAL_DCA');
      expect(msg).toContain('DCA_SPY_100');
      expect(msg).toContain('SPY');
      expect(msg).toContain('100.0%');
      expect(msg).toContain('Normaler Sparplan aktiv.');
      expect(msg).toContain('Makro-Stress Hub:');
    });

    it('should include warning banner for EMERGENCY_HEDGE', () => {
      const service = new StrategyNotificationService({ historyPath: TEST_HISTORY_PATH });
      const strategyResult = {
        status: 'EMERGENCY_HEDGE',
        trancheAction: 'ALLOCATE_75_GOLD_25_CASH',
        reason: 'Trendbruch unter SMA 200 mit VIX-Schock.',
        date: '2026-09-13',
        targetAllocationPct: { GLD: 75, CASH: 25 }
      };

      const msg = service.formatStrategyMessage('GOLD_SPY', strategyResult, {}, { name: 'Gold-SPY DCA' });

      expect(msg).toContain('KATASTROPHEN-SCHUTZSCHILD AKTIVIERT!');
      expect(msg).toContain('ALLOCATE_75_GOLD_25_CASH');
      expect(msg).toContain('GLD');
      expect(msg).toContain('75.0%');
    });

    it('should include cash-lock banner for PRE_MARGIN_CASH_LOCK and MARGIN_CALL_ACTIVE', () => {
      const service = new StrategyNotificationService({ historyPath: TEST_HISTORY_PATH });
      const msgPre = service.formatStrategyMessage('GOLD_SPY', { status: 'PRE_MARGIN_CASH_LOCK' });
      expect(msgPre).toContain('PRE-MARGIN-CALL GEWINNSICHERUNG!');

      const msgMargin = service.formatStrategyMessage('GOLD_SPY', { status: 'MARGIN_CALL_ACTIVE' });
      expect(msgMargin).toContain('MARGIN-CALL KASKADE IM GANGE');

      const msgReentry = service.formatStrategyMessage('GOLD_SPY', { status: 'RE_ENTRY_SNIPER' });
      expect(msgReentry).toContain('GENERATIONEN-BODEN SNIPER AKTIV!');
    });
  });

  describe('loadAlertHistory & saveAlertHistory', () => {
    it('should return empty object if history file does not exist', () => {
      const service = new StrategyNotificationService({ historyPath: TEST_HISTORY_PATH });
      expect(service.loadAlertHistory()).toEqual({});
    });

    it('should persist and reload history object', () => {
      const service = new StrategyNotificationService({ historyPath: TEST_HISTORY_PATH });
      const sample = { strategyStates: { TEST: { lastStatus: 'NORMAL' } } };
      service.saveAlertHistory(sample);

      const loaded = service.loadAlertHistory();
      expect(loaded).toEqual(sample);
    });
  });

  describe('dispatchStrategyAlerts', () => {
    it('should dispatch alert on initial state and save to alert history', async () => {
      process.env.NTFY_PORTFOLIO_GOLD_SPY = 'portfolio-gold-spy-test-topic';

      const mockSend = vi.fn().mockResolvedValue({});
      const mockNtfyBuilder = vi.fn().mockReturnValue({ send: mockSend });

      const service = new StrategyNotificationService({
        historyPath: TEST_HISTORY_PATH
      }, {
        ntfyServiceBuilder: mockNtfyBuilder
      });

      const evalResult = {
        date: '2026-09-13',
        strategyResults: {
          GOLD_SPY: {
            status: 'NORMAL_DCA',
            trancheAction: 'DCA_SPY_100',
            reason: 'Normaler Sparplan ausgeführt.',
            targetAllocationPct: { SPY: 100, CASH: 0 }
          }
        },
        macroSignalContext: {
          katastrophenMatrix: { status: 'NORMAL', isShieldActive: false },
          goldSniper: { state: 'IDLE', signal: 'NONE' }
        }
      };

      const alerts = await service.dispatchStrategyAlerts(evalResult);

      expect(alerts.length).toBe(1);
      expect(alerts[0].strategyId).toBe('GOLD_SPY');
      expect(alerts[0].topic).toBe('portfolio-gold-spy-test-topic');
      expect(mockNtfyBuilder).toHaveBeenCalledWith('portfolio-gold-spy-test-topic');
      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining('CrashRadar: Gold-SPY DCA'),
        expect.stringContaining('NORMAL_DCA'),
        'high', // channel manifest default or status override
        expect.any(Array)
      );

      // Verify history file updated
      const history = service.loadAlertHistory();
      expect(history.strategyStates.GOLD_SPY).toBeDefined();
      expect(history.strategyStates.GOLD_SPY.lastStatus).toBe('NORMAL_DCA');
    });

    it('should NOT dispatch alert when state is unchanged (smartphone silence)', async () => {
      process.env.NTFY_PORTFOLIO_GOLD_SPY = 'portfolio-gold-spy-test-topic';

      // Pre-seed history with current state
      const initialHistory = {
        strategyStates: {
          GOLD_SPY: {
            lastStatus: 'NORMAL_DCA',
            lastAction: 'DCA_SPY_100',
            lastAlertDate: '2026-09-12'
          }
        }
      };
      fs.writeFileSync(TEST_HISTORY_PATH, JSON.stringify(initialHistory, null, 2), 'utf8');

      const mockSend = vi.fn().mockResolvedValue({});
      const mockNtfyBuilder = vi.fn().mockReturnValue({ send: mockSend });

      const service = new StrategyNotificationService({
        historyPath: TEST_HISTORY_PATH
      }, {
        ntfyServiceBuilder: mockNtfyBuilder
      });

      const evalResult = {
        date: '2026-09-13',
        strategyResults: {
          GOLD_SPY: {
            status: 'NORMAL_DCA',
            trancheAction: 'DCA_SPY_100',
            reason: 'Normaler Sparplan.'
          }
        }
      };

      const alerts = await service.dispatchStrategyAlerts(evalResult, { forceSend: false });

      expect(alerts.length).toBe(0);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should suppress alert during silent return from RE_ENTRY_RESET to NORMAL_HODL but update history', async () => {
      process.env.NTFY_PORTFOLIO_SATELITE = 'portfolio-satellite-test-topic';

      // Pre-seed history with RE_ENTRY_RESET from yesterday
      const initialHistory = {
        strategyStates: {
          SATELITE: {
            lastStatus: 'RE_ENTRY_RESET',
            lastAction: 'REINVEST_TARGET_ALLOCATION',
            lastAlertDate: '2026-09-12'
          }
        }
      };
      fs.writeFileSync(TEST_HISTORY_PATH, JSON.stringify(initialHistory, null, 2), 'utf8');

      const mockSend = vi.fn().mockResolvedValue({});
      const mockNtfyBuilder = vi.fn().mockReturnValue({ send: mockSend });

      const service = new StrategyNotificationService({
        historyPath: TEST_HISTORY_PATH
      }, {
        ntfyServiceBuilder: mockNtfyBuilder
      });

      const evalResult = {
        date: '2026-09-13',
        strategyResults: {
          SATELITE: {
            status: 'NORMAL_HODL',
            action: 'HODL',
            reason: 'Bullenmarkt intakt.',
            targetAllocationPct: { SPY: 80, DFNS: 15, BTC: 5, GLD: 0, CASH: 0 }
          }
        }
      };

      const alerts = await service.dispatchStrategyAlerts(evalResult, { forceSend: false });

      // Stille Rückkehr: Keine Push-Nachricht!
      expect(alerts.length).toBe(0);
      expect(mockSend).not.toHaveBeenCalled();

      // Aber State History muss aktualisiert sein auf NORMAL_HODL
      const updatedHistory = service.loadAlertHistory();
      expect(updatedHistory.strategyStates.SATELITE.lastStatus).toBe('NORMAL_HODL');
      expect(updatedHistory.strategyStates.SATELITE.lastAction).toBe('HODL');

      delete process.env.NTFY_PORTFOLIO_SATELITE;
    });

    it('should dispatch alert when forceSend is true even if state is unchanged', async () => {
      process.env.NTFY_PORTFOLIO_GOLD_SPY = 'portfolio-gold-spy-test-topic';

      const initialHistory = {
        strategyStates: {
          GOLD_SPY: {
            lastStatus: 'NORMAL_DCA',
            lastAction: 'DCA_SPY_100',
            lastAlertDate: '2026-09-12'
          }
        }
      };
      fs.writeFileSync(TEST_HISTORY_PATH, JSON.stringify(initialHistory, null, 2), 'utf8');

      const mockSend = vi.fn().mockResolvedValue({});
      const mockNtfyBuilder = vi.fn().mockReturnValue({ send: mockSend });

      const service = new StrategyNotificationService({
        historyPath: TEST_HISTORY_PATH
      }, {
        ntfyServiceBuilder: mockNtfyBuilder
      });

      const evalResult = {
        date: '2026-09-13',
        strategyResults: {
          GOLD_SPY: {
            status: 'NORMAL_DCA',
            trancheAction: 'DCA_SPY_100',
            reason: 'Normaler Sparplan.'
          }
        }
      };

      const alerts = await service.dispatchStrategyAlerts(evalResult, { forceSend: true });

      expect(alerts.length).toBe(1);
      expect(mockSend).toHaveBeenCalled();
    });

    it('should dispatch emergency alert with high priority when state transitions to EMERGENCY_HEDGE', async () => {
      process.env.NTFY_PORTFOLIO_GOLD_SPY = 'portfolio-gold-spy-test-topic';

      const initialHistory = {
        strategyStates: {
          GOLD_SPY: {
            lastStatus: 'NORMAL_DCA',
            lastAction: 'DCA_SPY_100'
          }
        }
      };
      fs.writeFileSync(TEST_HISTORY_PATH, JSON.stringify(initialHistory, null, 2), 'utf8');

      const mockSend = vi.fn().mockResolvedValue({});
      const mockNtfyBuilder = vi.fn().mockReturnValue({ send: mockSend });

      const service = new StrategyNotificationService({
        historyPath: TEST_HISTORY_PATH
      }, {
        ntfyServiceBuilder: mockNtfyBuilder
      });

      const evalResult = {
        date: '2026-09-13',
        strategyResults: {
          GOLD_SPY: {
            status: 'EMERGENCY_HEDGE',
            trancheAction: 'ALLOCATE_75_GOLD_25_CASH',
            reason: 'Katastrophen-Matrix aktiv.'
          }
        }
      };

      const alerts = await service.dispatchStrategyAlerts(evalResult);

      expect(alerts.length).toBe(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining('ALLOCATE_75_GOLD_25_CASH'),
        expect.stringContaining('KATASTROPHEN-SCHUTZSCHILD AKTIVIERT!'),
        'high',
        expect.any(Array)
      );

      const updated = service.loadAlertHistory();
      expect(updated.strategyStates.GOLD_SPY.lastStatus).toBe('EMERGENCY_HEDGE');
    });

    it('should skip gracefully if env_topic_key is not set in environment', async () => {
      delete process.env.NTFY_PORTFOLIO_GOLD_SPY;

      const mockSend = vi.fn().mockResolvedValue({});
      const mockNtfyBuilder = vi.fn().mockReturnValue({ send: mockSend });

      const service = new StrategyNotificationService({
        historyPath: TEST_HISTORY_PATH
      }, {
        ntfyServiceBuilder: mockNtfyBuilder
      });

      const evalResult = {
        date: '2026-09-13',
        strategyResults: {
          GOLD_SPY: {
            status: 'NORMAL_DCA',
            trancheAction: 'DCA_SPY_100'
          }
        }
      };

      const alerts = await service.dispatchStrategyAlerts(evalResult, { forceSend: true });

      expect(alerts.length).toBe(0);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should catch send errors without throwing and let runner continue', async () => {
      process.env.NTFY_PORTFOLIO_GOLD_SPY = 'portfolio-gold-spy-test-topic';

      const mockSend = vi.fn().mockRejectedValue(new Error('Ntfy offline'));
      const mockNtfyBuilder = vi.fn().mockReturnValue({ send: mockSend });

      const service = new StrategyNotificationService({
        historyPath: TEST_HISTORY_PATH
      }, {
        ntfyServiceBuilder: mockNtfyBuilder
      });

      const evalResult = {
        date: '2026-09-13',
        strategyResults: {
          GOLD_SPY: {
            status: 'NORMAL_DCA',
            trancheAction: 'DCA_SPY_100'
          }
        }
      };

      await expect(service.dispatchStrategyAlerts(evalResult, { forceSend: true })).resolves.toEqual([]);
    });

    it('should correctly dispatch alerts for all configured strategies with their respective topic keys', async () => {
      process.env.NTFY_PORTFOLIO_TOPIC = 'topic-kamikaze';
      process.env.NTFY_PORTFOLIO_SATELITE = 'topic-satellite';
      process.env.NTFY_PORTFOLIO_7SLOT_GURU = 'topic-guru';
      process.env.NTFY_PORTFOLIO_MCW = 'topic-mcw';

      const mockSend = vi.fn().mockResolvedValue({});
      const mockNtfyBuilder = vi.fn().mockReturnValue({ send: mockSend });

      const service = new StrategyNotificationService({
        historyPath: TEST_HISTORY_PATH
      }, {
        ntfyServiceBuilder: mockNtfyBuilder
      });

      const evalResult = {
        date: '2026-09-13',
        strategyResults: {
          KAMIKAZE_GROWTH: { status: 'ACTIVE_MANAGEMENT', action: 'HOLD' },
          SATELITE: { status: 'NORMAL', action: 'HODL' },
          SEVEN_SLOT_GURU: { status: 'ACTIVE', action: 'HOLD' },
          MUZZLED_CATHIE_WOOD: { status: 'OBSERVE', action: 'HOLD' }
        }
      };

      const alerts = await service.dispatchStrategyAlerts(evalResult, { forceSend: true });

      expect(alerts.length).toBe(4);
      expect(alerts.map(a => a.strategyId)).toEqual(['KAMIKAZE_GROWTH', 'SATELITE', 'SEVEN_SLOT_GURU', 'MUZZLED_CATHIE_WOOD']);
      expect(alerts.map(a => a.topic)).toEqual(['topic-kamikaze', 'topic-satellite', 'topic-guru', 'topic-mcw']);

      delete process.env.NTFY_PORTFOLIO_TOPIC;
      delete process.env.NTFY_PORTFOLIO_SATELITE;
      delete process.env.NTFY_PORTFOLIO_7SLOT_GURU;
      delete process.env.NTFY_PORTFOLIO_MCW;
    });
  });
});
