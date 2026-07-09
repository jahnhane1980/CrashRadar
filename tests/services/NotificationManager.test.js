import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationManager } from '../../src/services/NotificationManager.js';

describe('NotificationManager (New Architecture)', () => {
    let manager;
    let mockConfig;

    beforeEach(() => {
        mockConfig = {
            topics: {
                'MACRO': { title: 'CrashRadar: Makro', icon: 'earth_africa', priority: 'high' },
                'CRYPTO': { title: 'CrashRadar: Crypto', icon: 'bitcoin', priority: 'default' }
            },
            indicators: {
                'Tech-Zyklus Radar': 'MACRO',
                'Bitcoin Regime': 'CRYPTO'
            }
        };
        manager = new NotificationManager(mockConfig);
    });

    const createMockMacroState = (overrides = {}) => ({
        regime: 'NORMAL',
        liquidityStatus: 'NORMAL',
        vetos: [],
        ...overrides
    });

    const createMockTradeAction = (overrides = {}) => ({
        indicator: 'Test Indicator',
        category: 'TRIGGER',
        status: 'WARNING',
        message: 'A warning message',
        blocked: false,
        blockReason: null,
        scaleDown: false,
        ...overrides
    });

    it('sollte einen sauberen Report generieren (cleanText = true)', () => {
        const macroState = createMockMacroState({ regime: 'LATE_CYCLE_EUPHORIA', vetos: ['VETO_1'] });
        const tradeActions = [
            createMockTradeAction({ status: 'CRITICAL', blocked: true, blockReason: 'MACRO_BLOCK' }),
            createMockTradeAction({ indicator: 'Another Indicator', status: 'WARNING', scaleDown: true })
        ];

        const report = manager.generateReport(macroState, tradeActions, '2026-07-09', true);
        
        expect(report).toContain('MAKRO-FINANZ ANALYSE');
        expect(report).toContain('[LATE_CYCLE_EUPHORIA]');
        expect(report).toContain('VETO_1');
        expect(report).toContain('[CRITICAL]');
        expect(report).toContain('BLOCKIERT: MACRO_BLOCK');
        expect(report).toContain('SCALE DOWN');
    });

    it('sollte getAlerts() erfolgreich ausführen und history updaten', () => {
        const macroState = createMockMacroState();
        const tradeActions = [
            createMockTradeAction({ indicator: 'Tech-Zyklus Radar', status: 'CRITICAL', message: 'Test Critical' }),
            createMockTradeAction({ indicator: 'Bitcoin Regime', status: 'WARNING', message: 'Test Warning' })
        ];

        const result = manager.getAlerts(macroState, tradeActions);
        
        expect(result.notifications).toBeDefined();
        expect(result.notifications.length).toBe(2);
        
        // MACRO topic got CRITICAL -> priority urgent
        const macroAlert = result.notifications.find(n => n.title.includes('Makro'));
        expect(macroAlert.priority).toBe('urgent');
        expect(macroAlert.message).toContain('🚨 CRITICAL');
        
        // CRYPTO topic got WARNING -> priority high
        const cryptoAlert = result.notifications.find(n => n.title.includes('Crypto'));
        expect(cryptoAlert.priority).toBe('high');
        expect(cryptoAlert.message).toContain('⚠️ WARNING');
        
        expect(Object.keys(result.updatedHistory).length).toBe(2);
    });

    it('sollte blockierte Actions bei getAlerts() ignorieren', () => {
        const macroState = createMockMacroState();
        const tradeActions = [
            createMockTradeAction({ blocked: true })
        ];

        const result = manager.getAlerts(macroState, tradeActions);
        expect(result.notifications).toBeNull();
    });

    it('sollte Debouncing (Spam-Schutz) anwenden', () => {
        const macroState = createMockMacroState();
        const tradeActions = [
            createMockTradeAction({ indicator: 'Tech-Zyklus Radar', status: 'WARNING' })
        ];

        // Erster Aufruf
        const result1 = manager.getAlerts(macroState, tradeActions);
        expect(result1.notifications).not.toBeNull();

        // Zweiter Aufruf (sofort danach, gleicher State)
        const result2 = manager.getAlerts(macroState, tradeActions, result1.updatedHistory);
        expect(result2.notifications).toBeNull(); // Blockiert durch Debounce
    });

    it('sollte DailyStatusReport generieren', () => {
        const macroState = createMockMacroState({ regime: 'FLASH_CRASH' });
        const tradeActions = [createMockTradeAction({ status: 'WARNING' })];
        
        const currentDayData = {
            mlRegimeSpy: { phase: 'BEAR_MARKET', confidence: 0.95 },
            mlRegimeQqq: { phase: 'BEAR_MARKET', confidence: 0.90 },
            mlRegimeBtc: { phase: 'CYCLE_BOTTOM', confidence: 0.85 }
        };

        const result = manager.getDailyStatusReport(macroState, tradeActions, currentDayData);
        
        expect(result).toBeDefined();
        // FLASH_CRASH -> Overall CRITICAL
        expect(result.title).toContain('Daily Status (CRITICAL)');
        expect(result.message).toContain('FLASH_CRASH');
        expect(result.message).toContain('BEAR_MARKET (95.0%)');
        expect(result.message).toContain('CYCLE_BOTTOM (85.0%)');
    });

    it('sollte null zurückgeben bei getAlerts wenn tradeActions leer/null ist', () => {
        const macroState = createMockMacroState();
        
        const result1 = manager.getAlerts(macroState, null);
        expect(result1.notifications).toBeNull();
        
        const result2 = manager.getAlerts(macroState, []);
        expect(result2.notifications).toBeNull();
    });
});
