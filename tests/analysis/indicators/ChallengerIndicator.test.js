import { ChallengerIndicator } from '../../../src/analysis/indicators/ChallengerIndicator.js';

describe('ChallengerIndicator', () => {
    let indicator;

    beforeEach(() => {
        indicator = new ChallengerIndicator();
    });

    const buildTimeline = (challengerValues) => {
        const daysPerMonth = 30;
        const totalDaysToFill = challengerValues.length * daysPerMonth;
        const timelineLength = Math.max(180, totalDaysToFill);

        // Wir brauchen mind. 180 Tage in der Timeline
        const timeline = new Array(timelineLength).fill(null).map(() => ({
            macroGroups: { Leading: { Challenger: null } }
        }));
        
        const startOffset = timelineLength - totalDaysToFill;

        for (let i = 0; i < challengerValues.length; i++) {
            const val = challengerValues[i];
            for (let d = 0; d < daysPerMonth; d++) {
                const dayIndex = startOffset + (i * daysPerMonth) + d;
                timeline[dayIndex].macroGroups.Leading.Challenger = val;
            }
        }
        
        return timeline;
    };

    test('should return UNKNOWN if timeline is too short', () => {
        const result = indicator.evaluate(new Array(179));
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Zu wenig Daten');
    });

    test('should return UNKNOWN if no data is available', () => {
        const timeline = buildTimeline([]);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
    });

    test('should return UNKNOWN if NO history is available for SMA', () => {
        // Nur ein einziger Wert, also keine Historie zum Vergleichen
        const timeline = buildTimeline([1000]);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('Zu wenig Historie');
    });

    test('should calculate average dynamically if less than 6 months history available', () => {
        // Nur 5 Historien-Werte + aktueller Wert = 6 Werte
        // 1000, 1100, 1200, 1300, 1400 (SMA = 1200) -> current = 1500 (+25%) -> OK
        const timeline = buildTimeline([1000, 1100, 1200, 1300, 1400, 1500]);
        const result = indicator.evaluate(timeline);
        expect(result.status).toBe('OK');
    });

    test('should return OK if change is below 40%', () => {
        const fakeMonths = [1000, 1001, 1002, 1003, 1004, 1005]; // SMA6 = 1002.5
        // current = 1300 (+29.6%)
        fakeMonths.push(1300);
        
        const timeline = buildTimeline(fakeMonths);
        const result = indicator.evaluate(timeline);
        
        expect(result.status).toBe('OK');
    });

    test('should return WARNING if change is >= 40% but < 55%', () => {
        const fakeMonths = [1000, 1001, 1002, 1003, 1004, 1005]; // SMA6 = 1002.5
        // +45% = 1454
        fakeMonths.push(1454);
        
        const timeline = buildTimeline(fakeMonths);
        const result = indicator.evaluate(timeline);
        
        expect(result.status).toBe('WARNING');
        expect(result.message).toContain('steigt stark an');
    });

    test('should return CRITICAL if change is >= 55%', () => {
        const fakeMonths = [1000, 1001, 1002, 1003, 1004, 1005]; // SMA6 = 1002.5
        // +60% = 1604
        fakeMonths.push(1604);
        
        const timeline = buildTimeline(fakeMonths);
        const result = indicator.evaluate(timeline);
        
        expect(result.status).toBe('CRITICAL');
        expect(result.message).toContain('Alarmstufe Rot');
    });

    test('should handle Division by Zero when sma6 is 0', () => {
        // Historie von 6 Monaten mit Wert 0, plus ein aktueller Wert
        const fakeMonths = [0, 0, 0, 0, 0, 0, 500];
        const timeline = buildTimeline(fakeMonths);
        const result = indicator.evaluate(timeline);
        
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('SMA6 ist 0');
    });
});
