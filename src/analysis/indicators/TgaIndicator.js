export class TgaIndicator {
    constructor() {
        this.name = 'Treasury General Account (TGA)';
        this.category = 'LEADING';
        this.THRESHOLDS = {
            TGA_DIFF: 100
        };
    }

    evaluate(timeline) {
        if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
        const currentDay = timeline[timeline.length - 1];
        const pastDay = timeline[timeline.length - 30];
        
        const currentTGA = currentDay.macroGroups.NetLiquidity.TGA;
        const pastTGA = pastDay.macroGroups.NetLiquidity.TGA;
        
        if (currentTGA === null || pastTGA === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
        
        const diff = currentTGA - pastTGA;
        if (diff > this.THRESHOLDS.TGA_DIFF) {
            return { status: 'WARNING', value: currentTGA.toFixed(0) + 'B', message: `Starker Anstieg (+${diff.toFixed(0)}B in 30d). Entzieht Liquidität.` };
        } else if (diff < -this.THRESHOLDS.TGA_DIFF) {
            return { status: 'OK', value: currentTGA.toFixed(0) + 'B', message: `Rasanter Fall (${diff.toFixed(0)}B in 30d). Stealth-Stimulus / Kaufsignal.` };
        }
        return { status: 'OK', value: currentTGA.toFixed(0) + 'B', message: 'Neutrale Seitwärtsbewegung.' };
    }
}
