/**
 * @deprecated Dieser Indikator ist veraltet und wird nicht mehr als primärer Boden-Trigger empfohlen.
 * 
 * EMPIRISCHE KRITIK & SCHWACHSTELLEN-ANALYSE (2007–2026):
 * 1. Asynchroner Publikations-Lag (AAII Sentiment):
 *    - Das AAII-Sentiment wird nur 1x wöchentlich donnerstags publiziert.
 *    - Wenn ein Crash-Boden an einem Montag oder Dienstag markiert wird (z. B. 23.03.2020 Corona),
 *      hinkt AAII bis zu 6 Handelstage hinterher und blockiert den zeitnahen Einstieg.
 * 2. Starre VIX > 40 Schwelle:
 *    - In strukturellen Zins- und Bewertungs-Crashs (z. B. Q4 2018 bei VIX 36.1, oder 2022 bei VIX 36.5)
 *      erreicht die Volatilität die harte 40er-Marke nie, wodurch das Signal komplett ausbleibt.
 * 3. Mangelnde Atomarität (Monolithische Überladung):
 *    - Durch die starre UND-Verknüpfung von drei voneinander völlig unabhängigen Datenwelten
 *      (wöchentliches Retail-Sentiment, tägliche Volatilität, Dark-Pool-Wal-Akkumulation)
 *      entsteht ein Signal-Flaschenhals, der in realen Krisen fast nie feuerte.
 * 
 * NACHFOLGER / MODERNE ARCHITEKTUR:
 * Trennung in atomare Sensoren (z. B. Dark-Pool Wal-Akkumulation, VIX Volatility Dynamics)
 * und Orchestrierung über die PortfolioStrategyEngine / GoldSniperIndicator.
 */
export class SmartDumbMoneyBottomIndicator {
    constructor() {
        this.name = 'Smart vs Dumb Money (The Bottom)';
        this.category = 'BOTTOM_FINDER';
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        
        const currentDay = timeline[timeline.length - 1];
        
        let vix = currentDay?.assets?.VIX;
        let aaiiSpread = currentDay?.assets?.AAII_Spread;
        let dix = currentDay?.assets?.DIX;
        
        if (vix == null || aaiiSpread == null || dix == null) {
            return { status: 'UNKNOWN', message: 'Keine VIX, AAII oder DIX Daten vorhanden' };
        }
        
        vix = Number(vix);
        aaiiSpread = Number(aaiiSpread);
        dix = Number(dix);
        
        // Normalize DIX if it is represented as decimal (0.45) instead of percentage (45%)
        if (dix > 0 && dix <= 1) dix = dix * 100;

        if (isNaN(vix) || isNaN(aaiiSpread) || isNaN(dix)) {
            return { status: 'UNKNOWN', message: 'Ungültige Daten (keine Zahlen)' };
        }
        
        if (vix > 40 && aaiiSpread < -25 && dix > 45) {
            return { 
                status: 'CRITICAL', 
                value: `VIX:${vix.toFixed(1)}|AAII:${aaiiSpread.toFixed(1)}%|DIX:${dix.toFixed(1)}%`, 
                message: `KAPITULATION! Retail in totaler Panik (AAII < -25% & VIX > 40), WÄHREND Wale extrem stark akkumulieren (DIX > 45%). V-Shape Reversal imminent!`
            };
        }
        
        return { status: 'OK', value: '-', message: 'Kein Bottom-Setup aktiv.' };
    }
}
