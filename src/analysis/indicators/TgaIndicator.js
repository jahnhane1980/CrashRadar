export class TgaIndicator {
    constructor() {
        this.name = 'Treasury General Account (TGA)';
        this.category = 'LEADING';
        this.THRESHOLDS = {
            TGA_DIFF: 100
        };
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
        const currentDay = timeline[timeline.length - 1];
        const pastDay = timeline[timeline.length - 30];
        
        let currentTGA = currentDay?.macroGroups?.NetLiquidity?.TGA;
        let pastTGA = pastDay?.macroGroups?.NetLiquidity?.TGA;
        
        if (currentTGA == null || pastTGA == null) return { status: 'UNKNOWN', message: 'Keine Daten' };
        
        // Fange JS Type-Coercion Bugs ab
        if (typeof currentTGA !== 'number' && typeof currentTGA !== 'string') return { status: 'UNKNOWN', message: 'Ungültiger Datentyp' };
        if (typeof pastTGA !== 'number' && typeof pastTGA !== 'string') return { status: 'UNKNOWN', message: 'Ungültiger Datentyp' };
        if (typeof currentTGA === 'string' && currentTGA.trim() === '') return { status: 'UNKNOWN', message: 'Leerer Wert' };
        if (typeof pastTGA === 'string' && pastTGA.trim() === '') return { status: 'UNKNOWN', message: 'Leerer Wert' };
        
        currentTGA = Number(currentTGA);
        pastTGA = Number(pastTGA);
        
        if (isNaN(currentTGA) || isNaN(pastTGA)) return { status: 'UNKNOWN', message: 'Ungültige Daten (keine Zahlen)' };
        
        const diff = currentTGA - pastTGA;
        if (diff > this.THRESHOLDS.TGA_DIFF) {
            return { status: 'WARNING', value: currentTGA.toFixed(0) + 'B', message: `Starker Anstieg (+${diff.toFixed(0)}B in 30d). Entzieht Liquidität.` };
        } else if (diff < -this.THRESHOLDS.TGA_DIFF) {
            return { status: 'OK', value: currentTGA.toFixed(0) + 'B', message: `Rasanter Fall (${diff.toFixed(0)}B in 30d). Stealth-Stimulus / Kaufsignal.` };
        }
        return { status: 'OK', value: currentTGA.toFixed(0) + 'B', message: 'Neutrale Seitwärtsbewegung.' };
    }
}
