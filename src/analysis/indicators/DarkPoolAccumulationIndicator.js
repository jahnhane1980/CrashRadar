/**
 * DarkPoolAccumulationIndicator
 * 
 * Atomarer Sensor für institutionelle Wal-Akkumulation über Dark Pools (SqueezeMetrics DIX).
 * 
 * METHODIK:
 * Der Dark Index (DIX) misst den prozentualen Anteil des Kaufvolumens an allen Transaktionen
 * in außerbörslichen Dark Pools für S&P 500 Komponenten.
 * Ein Wert >= 45 % signalisiert statistisch signifikante Akkumulation durch institutionelle Anleger (Whales).
 * Werte >= 48 % - 50 % treten fast ausschließlich in akuten Crash-Böden auf (Smart-Money-Aufsaugen).
 * 
 * SCHWELLENWERTE:
 * - DIX >= 48.0 %: Starke, aggressive Wal-Akkumulation (CRITICAL)
 * - 3-Tage-Schnitt >= 45.0 %: Nachhaltige Mehrtages-Akkumulation (CRITICAL)
 * - DIX >= 45.0 % (Einzeltag): Erhöhte Kaufaktivität / Setup-Bildung (WARNING)
 * - DIX < 45.0 %: Normalbereich (OK)
 */
export class DarkPoolAccumulationIndicator {
    constructor(config = {}) {
        this.name = 'Dark Pool Wal-Akkumulation (DIX)';
        this.category = 'BOTTOM_FINDER';
        this.THRESHOLDS = {
            DIX_STRONG: config.dixStrong ?? 48.0,
            DIX_ACCUMULATION: config.dixAccumulation ?? 45.0,
            AVG_DAYS: config.avgDays ?? 3
        };
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length < 1) {
            return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        }

        const currentDay = timeline[timeline.length - 1];
        let rawDix = currentDay?.assets?.DIX;
        if (rawDix == null) {
            return { status: 'UNKNOWN', message: 'Keine DIX-Daten vorhanden' };
        }

        let dix = Number(rawDix);
        if (isNaN(dix)) {
            return { status: 'UNKNOWN', message: 'Ungültige DIX-Daten (keine Zahl)' };
        }

        // Normalisierung: Falls DIX als Dezimalwert (z.B. 0.46 statt 46) übergeben wird
        if (dix > 0 && dix <= 1) {
            dix = dix * 100;
        }

        // Berechne rollierenden Durchschnitt zur Rauschunterdrückung
        let sum = 0;
        let count = 0;
        const lookback = Math.min(timeline.length, this.THRESHOLDS.AVG_DAYS);
        for (let i = timeline.length - lookback; i < timeline.length; i++) {
            let d = timeline[i]?.assets?.DIX;
            if (d != null) {
                let val = Number(d);
                if (val > 0 && val <= 1) val = val * 100;
                if (!isNaN(val)) {
                    sum += val;
                    count++;
                }
            }
        }
        const avgDix = count > 0 ? sum / count : dix;

        // 1. CRITICAL: Aggressive Wal-Akkumulation
        // (Tageswert >= 48% ODER stabiler 3-Tage-Schnitt >= 45%)
        if (dix >= this.THRESHOLDS.DIX_STRONG || avgDix >= this.THRESHOLDS.DIX_ACCUMULATION) {
            return {
                status: 'CRITICAL',
                value: `DIX:${dix.toFixed(1)}%|3d:${avgDix.toFixed(1)}%`,
                message: `WAL-AKKUMULATION! Institutionelle Investoren akkumulieren massiv über Dark Pools (DIX: ${dix.toFixed(1)}%, 3d-Schnitt: ${avgDix.toFixed(1)}% >= 45%).`
            };
        }

        // 2. WARNING: Erhöhte Aktivität (Einzeltag >= 45%)
        if (dix >= this.THRESHOLDS.DIX_ACCUMULATION) {
            return {
                status: 'WARNING',
                value: `DIX:${dix.toFixed(1)}%|3d:${avgDix.toFixed(1)}%`,
                message: `Erhöhte Dark-Pool-Käufe (DIX: ${dix.toFixed(1)}% >= 45%). Setup formiert sich.`
            };
        }

        // 3. OK: Normalbereich
        return {
            status: 'OK',
            value: `DIX:${dix.toFixed(1)}%|3d:${avgDix.toFixed(1)}%`,
            message: 'Dark-Pool-Aktivität im normalen Bereich.'
        };
    }
}
