import { NotificationManager } from '../src/services/NotificationManager.js';

const mockMacroState = {
    regime: 'LATE_CYCLE_EUPHORIA',
    liquidityStatus: 'NORMAL',
    vetos: [],
    indicatorDetails: [
        { name: 'Margin Debt (Gier & Hebel)', category: 'EARLY_WARNING', status: 'CRITICAL', value: '-6.5%' },
        { name: 'Yield Curve (T10Y2Y)', category: 'EARLY_WARNING', status: 'OK' },
        { name: 'Treasury General Account (TGA)', category: 'EARLY_WARNING', status: 'OK' },
        { name: 'Red Alert (Bullenmarkt-Stirbt-Signal)', category: 'ACUTE_PANIC', status: 'WARNING' },
        { name: 'High Yield Spreads (HYG)', category: 'ACUTE_PANIC', status: 'OK' },
        { name: 'Panik-Kapitulation (VIX + CBOE + RSI)', category: 'BOTTOM_FINDER', status: 'OK' },
        { name: 'Macro Interest Rate Cycle', category: 'MACRO_CONTEXT', status: 'OK' }
    ]
};

const mockCurrentDayData = {
    mlRegimeSpy: { phase: 'UPTREND', confidence: 0.872 },
    mlRegimeQqq: { phase: 'UPTREND', confidence: 0.921 },
    mlRegimeBtc: { phase: 'MACRO_TOP', confidence: 0.554 }
};

const manager = new NotificationManager({});
const report = manager.getDailyStatusReport(mockMacroState, [], mockCurrentDayData);

console.log("=== VORSCHAU WETTERBERICHT ===");
console.log(report.title);
console.log("------------------------------");
console.log(report.message);
