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

    it('sollte DailyStatusReport mit 4-Block-Layout generieren (FLASH_CRASH -> CRITICAL)', () => {
        const macroState = createMockMacroState({
            regime: 'FLASH_CRASH',
            indicatorDetails: [
                { name: 'Panik-Kapitulation (VIX + CBOE + RSI)', status: 'CRITICAL' },
                { name: 'Treasury & Money Market Capacity Radar', status: 'WARNING', value: '58.5/100', projectedCollision: '26.10.2026 – 10.11.2026' }
            ]
        });

        const result = manager.getDailyStatusReport(macroState, []);
        
        expect(result).toBeDefined();
        expect(result.title).toContain('Makro-Wetterbericht (CRITICAL)');
        expect(result.message).toContain('MAKRO-WETTERBERICHT');
        expect(result.message).toContain('1. LIQUIDITÄTS-RADAR');
        expect(result.message).toContain('2. SPEZIAL-WÄCHTER');
        expect(result.message).toContain('3. AKUTE NOTBREMSEN');
        expect(result.message).toContain('4. BODEN-FINDER');
        expect(result.message).toContain('26.10.2026 – 10.11.2026');
        expect(result.message).toContain('Kapitulations-Boden aktiv');
    });

    it('sollte DailyStatusReport im Normalzustand als stabil und grün formatieren', () => {
        const macroState = createMockMacroState({
            regime: 'NORMAL',
            indicatorDetails: [
                { name: 'Treasury & Money Market Capacity Radar', status: 'OK', value: '25.0/100' },
                { name: 'Margin Debt (Gier & Hebel)', status: 'OK' },
                { name: 'Red Alert (Bullenmarkt-Stirbt-Signal)', status: 'OK' },
                { name: 'Chicago Fed Stress Index (NFCI)', status: 'OK', value: '-0.60' }
            ]
        });

        const report = manager.getDailyStatusReport(macroState, []);
        expect(report.title).toContain('Makro-Wetterbericht (OK)');
        expect(report.message).toContain('STABILER MARKT (Liquide)');
        expect(report.message).toContain('Margin Debt stabil');
        expect(report.message).toContain('Keine institutionelle Panik-Absicherung');
        expect(report.message).toContain('Interbankenmarkt voll liquide');
    });

    it('sollte DailyStatusReport im Spätzyklus mit Puffer-Phase und Kollisionsfenster formatieren', () => {
        const macroState = createMockMacroState({
            regime: 'NORMAL',
            vetos: ['TREASURY_CAPACITY_WARNING', 'DELEVERAGING_ONGOING'],
            indicatorDetails: [
                { 
                    name: 'Treasury & Money Market Capacity Radar', 
                    status: 'WARNING', 
                    value: '58.5/100',
                    projectedCollision: '26.10.2026 – 10.11.2026',
                    details: { liquidSlackBillion: 201, monthlyBuybacksBillion: 48.6 }
                },
                { name: 'Margin Debt (Gier & Hebel)', status: 'WARNING', value: '-5.6%' }
            ]
        });

        const report = manager.getDailyStatusReport(macroState, []);
        expect(report.title).toContain('Makro-Wetterbericht (WARNING)');
        expect(report.message).toContain('SPÄTZYKLUS-PUFFER');
        expect(report.message).toContain('26.10.2026 – 10.11.2026');
        expect(report.message).toContain('$201B TGA-Cushion');
        expect(report.message).toContain('ALARM: Margin Debt (-5.6%)');
        expect(report.message).toContain('TREASURY_CAPACITY_WARNING');
        expect(report.message).toContain('DELEVERAGING_ONGOING');
    });

    it('sollte null zurückgeben bei getAlerts wenn tradeActions leer/null ist', () => {
        const macroState = createMockMacroState();
        
        const result1 = manager.getAlerts(macroState, null);
        expect(result1.notifications).toBeNull();
        
        const result2 = manager.getAlerts(macroState, []);
        expect(result2.notifications).toBeNull();
    });

    describe('Dynamisches Debouncing im Crisis Mode', () => {
        it('sollte das Debouncing für Gold im FLASH_CRASH auf 2 Tage verkürzen', () => {
            const macroState = createMockMacroState({ regime: 'FLASH_CRASH' });
            const tradeActions = [
                createMockTradeAction({ indicator: 'Gold V-Shape Bottom', status: 'CRITICAL', message: 'Kauf mich' }),
                createMockTradeAction({ indicator: 'SPY Bottom', status: 'CRITICAL', message: 'Mich auch' })
            ];
            
            // Simuliere, dass beide Alarme vor exakt 3 Tagen gesendet wurden
            // (ein paar Millisekunden extra, um sicher über der Zeitgrenze zu sein)
            const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000) - 1000; 
            const alertHistory = {
                'Gold V-Shape Bottom_CRITICAL': threeDaysAgo,
                'SPY Bottom_CRITICAL': threeDaysAgo
            };
            
            const result = manager.getAlerts(macroState, tradeActions, alertHistory, 14);
            
            expect(result.notifications).not.toBeNull();
            // Nur der Gold Alarm darf durchkommen, der SPY Alarm wird vom 14-Tage Filter gefressen
            expect(result.notifications.length).toBe(1);
            expect(result.notifications[0].message).toContain('Gold V-Shape Bottom');
        });

        it('sollte das Debouncing nach dem Crash automatisch auf 14 Tage zurücksetzen', () => {
            const macroState = createMockMacroState({ regime: 'BEAR_MARKET' }); // Kein FLASH_CRASH mehr
            const tradeActions = [
                createMockTradeAction({ indicator: 'Gold V-Shape Bottom', status: 'CRITICAL', message: 'Kauf mich' })
            ];
            
            // Simuliere, dass der Alarm vor 3 Tagen gesendet wurde
            const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000) - 1000;
            const alertHistory = {
                'Gold V-Shape Bottom_CRITICAL': threeDaysAgo
            };
            
            const result = manager.getAlerts(macroState, tradeActions, alertHistory, 14);
            
            // Im BEAR_MARKET greifen wieder harte 14 Tage. 3 Tage sind zu wenig. Alarm blockiert!
            expect(result.notifications).toBeNull();
        });

        it('sollte im FLASH_CRASH Spam unter 2 Tagen trotzdem abwehren', () => {
            const macroState = createMockMacroState({ regime: 'FLASH_CRASH' });
            const tradeActions = [
                createMockTradeAction({ indicator: 'Gold V-Shape Bottom', status: 'CRITICAL', message: 'Kauf mich' })
            ];
            
            // Simuliere, dass der Alarm erst vor 1 Tag gesendet wurde
            const oneDayAgo = Date.now() - (1 * 24 * 60 * 60 * 1000) - 1000;
            const alertHistory = {
                'Gold V-Shape Bottom_CRITICAL': oneDayAgo
            };
            
            const result = manager.getAlerts(macroState, tradeActions, alertHistory, 14);
            
            // Obwohl 2-Tage-Regel aktiv ist, ist 1 Tag zu früh. Blockiert!
            expect(result.notifications).toBeNull();
        });
    });
});
