export class GoldCapitulationIndicator {
    constructor() {
        this.name = '[INVEST] Gold Capitulation & Healing (2-Step)';
        this.category = 'BOTTOM_FINDER';
    }

    evaluate(timeline) {
        if (timeline.length < 50) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        
        const today = timeline[timeline.length - 1];
        const gcClose = today.assets.Gold;
        if (!gcClose) return { status: 'UNKNOWN', message: 'Keine Gold-Daten' };

        // Berechne SMA 20 von heute
        let sumPrice = 0, countPrice = 0;
        for (let i = timeline.length - 20; i < timeline.length; i++) {
        if (timeline[i].assets.Gold) {
            sumPrice += timeline[i].assets.Gold;
            countPrice++;
        }
        }
        const sma20 = sumPrice / countPrice;

        // Ist heute der Ausbruch über den SMA 20?
        const yesterday = timeline[timeline.length - 2];
        const isBreakout = (yesterday.assets.Gold < sma20 && gcClose > sma20);

        // Suche nach einem Trauma in den letzten 30 Tagen (ohne heute)
        let recentTrauma = null;
        for (let i = timeline.length - 30; i < timeline.length - 1; i++) {
        if (i < 50) continue;
        
        const pastVol = timeline[i].assets.Gold_Volume;
        const pastClose = timeline[i].assets.Gold;
        if (!pastVol || !pastClose) continue;

        // 50-Tage Durchschnittsvolumen vor dem Trauma-Tag
        let sumVol = 0, countVol = 0;
        for (let j = i - 50; j < i; j++) {
            if (timeline[j].assets.Gold_Volume > 0) {
            sumVol += timeline[j].assets.Gold_Volume;
            countVol++;
            }
        }
        if (countVol === 0) continue;
        const avgVol = sumVol / countVol;

        // 10-Tage Drop vor dem Trauma-Tag
        const past10 = timeline[i-10]?.assets.Gold;
        const drop10 = past10 ? ((pastClose - past10) / past10) * 100 : 0;

        if (pastVol > avgVol * 3.0 && drop10 <= -2.0) {
            recentTrauma = timeline[i].date;
        }
        }

        if (recentTrauma && isBreakout) {
        return { status: 'CRITICAL', value: 'HEALING', message: `BODEN GEFUNDEN! Gold durchbricht nach dem Liquidations-Trauma vom ${recentTrauma} den SMA 20. Liquidität fließt zurück ins System!` };
        } else if (recentTrauma) {
        return { status: 'WARNING', value: 'TRAUMA', message: `Gold ist am ${recentTrauma} massiv ausgeblutet (Margin Calls). Wir warten auf den SMA 20 Ausbruch zur Bestätigung.` };
        }
        
        return { status: 'OK', value: 'NORMAL', message: 'Keine extremen Panik-Muster bei Gold.' };
    }
}
