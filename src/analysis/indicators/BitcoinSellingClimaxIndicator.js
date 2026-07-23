export class BitcoinSellingClimaxIndicator {
    constructor() {
        this.name = 'Bitcoin Selling Climax (Panik/Boden)';
        this.category = 'BOTTOM_FINDER';
    }

    evaluate(timeline) {
        if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        
        const currentDay = timeline[timeline.length - 1];
        const prevDay = timeline[timeline.length - 2];
        
        const currentBtc = currentDay.assets.BTC;
        const prevBtc = prevDay.assets.BTC;
        const currentBtcVol = currentDay.assets.BTC_Volume;
        
        if (!currentBtc || !prevBtc || !currentBtcVol) return { status: 'UNKNOWN', message: 'Keine Volumen/Preis-Daten für BTC' };
        
        let sumVol = 0, count = 0;
        for (let i = timeline.length - 30; i < timeline.length; i++) {
            const v = timeline[i].assets.BTC_Volume;
            if (v && v > 0) { sumVol += v; count++; }
        }
        
        if (count === 0) return { status: 'UNKNOWN', message: 'Keine gültigen Volumendaten' };
        const avgVol = sumVol / count;
        const volRatio = currentBtcVol / avgVol;
        const priceChangePct = ((currentBtc - prevBtc) / prevBtc) * 100;
        
        if (volRatio >= 4.0 && priceChangePct <= -5.0) {
            return { status: 'CRITICAL', value: `${volRatio.toFixed(1)}x Vol, ${priceChangePct.toFixed(1)}%`, message: 'BTC SELLING CLIMAX! Gigantischer Flush-Out. Makro-Liquiditäts-Tiefpunkt erreicht!' };
        }
        return { status: 'OK', value: `${volRatio.toFixed(1)}x Vol`, message: 'Kein Krypto-Ausverkauf.' };
    }
}
