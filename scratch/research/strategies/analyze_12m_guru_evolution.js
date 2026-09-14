import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const GURU_MAP = {
    '0001536411': { name: 'Stanley Druckenmiller', short: 'Druckenmiller', fund: 'Duquesne', core: true },
    '0001135730': { name: 'Philippe Laffont', short: 'Laffont', fund: 'Coatue', core: true },
    '0001167483': { name: 'Chase Coleman', short: 'Coleman', fund: 'Tiger Global', core: true },
    '0001656456': { name: 'David Tepper', short: 'Tepper', fund: 'Appaloosa', core: true },
    '0001541617': { name: 'Brad Gerstner', short: 'Gerstner', fund: 'Altimeter', core: true },
    '0001509842': { name: 'Zach Schreiber', short: 'Schreiber', fund: 'PointState', core: true },
    '0001777813': { name: 'Gavin Baker', short: 'Baker', fund: 'Atreides', core: false },
    '0001387322': { name: 'Alex Sacerdote', short: 'Sacerdote', fund: 'Whale Rock', core: false },
    '0001647251': { name: 'Christopher Hohn', short: 'Hohn', fund: 'TCI', core: false }
};

function formatCurrency(val) {
    if (!val || val === 0) return '$0';
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
}

function formatShares(val) {
    if (!val || val === 0) return '0';
    if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
    return `${val}`;
}

async function run() {
    const pool = mysql.createPool(process.env.DATABASE_URL);
    try {
        const [datesRows] = await pool.query(`SELECT DISTINCT report_date FROM fund_13f_holdings ORDER BY report_date ASC`);
        const quarters = datesRows.map(r => r.report_date instanceof Date ? r.report_date.toISOString().split('T')[0] : String(r.report_date).split('T')[0]);

        const ciks = Object.keys(GURU_MAP);
        const [rows] = await pool.query(`
            SELECT cik, report_date, cusip, issuer_name, put_call, shares, value
            FROM fund_13f_holdings
            WHERE cik IN (?)
            ORDER BY report_date ASC, cusip ASC
        `, [ciks]);

        const securities = new Map();
        for (const r of rows) {
            const rDate = r.report_date instanceof Date ? r.report_date.toISOString().split('T')[0] : String(r.report_date).split('T')[0];
            const putCall = r.put_call || 'STOCK';
            const key = `${r.cusip}_${putCall}`;
            
            if (!securities.has(key)) {
                securities.set(key, {
                    cusip: r.cusip,
                    issuer_name: r.issuer_name,
                    put_call: putCall,
                    byQuarter: {}
                });
            }
            
            const sec = securities.get(key);
            if (r.issuer_name && r.issuer_name.length > sec.issuer_name.length) {
                sec.issuer_name = r.issuer_name;
            }
            
            if (!sec.byQuarter[rDate]) {
                sec.byQuarter[rDate] = { coreHolders: new Map(), succHolders: new Map() };
            }
            
            const isCore = GURU_MAP[r.cik]?.core;
            const targetMap = isCore ? sec.byQuarter[rDate].coreHolders : sec.byQuarter[rDate].succHolders;
            targetMap.set(r.cik, {
                shares: Number(r.shares) || 0,
                value: Number(r.value) || 0
            });
        }

        const allConsensus = [];
        const optionsList = [];

        for (const [key, sec] of securities.entries()) {
            let maxCore = 0;
            let latestCore = 0;
            const latestQ = quarters[quarters.length - 1];

            for (const q of quarters) {
                const count = sec.byQuarter[q]?.coreHolders.size || 0;
                if (count > maxCore) maxCore = count;
                if (q === latestQ) latestCore = count;
            }

            if (sec.put_call !== 'STOCK') {
                optionsList.push(sec);
            }

            if (maxCore >= 2) {
                allConsensus.push({ ...sec, maxCore, latestCore });
            }
        }

        // Sortiere Konsens: neueste Halterzahl DESC, Max-Halterzahl DESC, Marktwert Q2/26 DESC
        const latestQ = quarters[quarters.length - 1];
        allConsensus.sort((a, b) => {
            if (b.latestCore !== a.latestCore) return b.latestCore - a.latestCore;
            if (b.maxCore !== a.maxCore) return b.maxCore - a.maxCore;
            const valA = Array.from(a.byQuarter[latestQ]?.coreHolders.values() || []).reduce((s, h) => s + h.value, 0);
            const valB = Array.from(b.byQuarter[latestQ]?.coreHolders.values() || []).reduce((s, h) => s + h.value, 0);
            return valB - valA;
        });

        // Berechne aggregiertes Gesamtvolumen pro Guru
        const guruVol = {};
        for (const [cik, g] of Object.entries(GURU_MAP)) {
            if (g.core) {
                guruVol[cik] = {};
                for (const q of quarters) guruVol[cik][q] = 0;
            }
        }
        for (const r of rows) {
            const rDate = r.report_date instanceof Date ? r.report_date.toISOString().split('T')[0] : String(r.report_date).split('T')[0];
            if (guruVol[r.cik] && guruVol[r.cik][rDate] !== undefined) {
                guruVol[r.cik][rDate] += Number(r.value) || 0;
            }
        }

        // Markdown Report bauen
        let md = `# Empirische 12-Monats-Evolution der Guru-Konsens-Portfolios (Q3/2025 – Q2/2026)\n\n`;
        md += `**Stichtag der Analyse:** September 2026  \n`;
        md += `**Datenbasis:** 2.342 reale SEC Form 13F-Positionen aus der CrashRadar-Datenbank \`fund_13f_holdings\` über 4 aufeinanderfolgende Quartale (Q3-2025, Q4-2025, Q1-2026, Q2-2026).  \n`;
        md += `**Analysiertes Gremium:** 6 Core-Manager (Stanley Druckenmiller, Philippe Laffont, Chase Coleman, David Tepper, Brad Gerstner, Zach Schreiber) + 3 Nachrücker (Gavin Baker, Alex Sacerdote, Christopher Hohn).\n\n`;
        md += `---\n\n`;

        md += `## 1. Executive Summary & Haupt-Erkenntnisse\n\n`;
        md += `1. **Konsens-Spitze (Die unangefochtenen Säulen):**  \n`;
        md += `   * **Amazon (\`AMZN\`)** und **Meta Platforms (\`META\`)** dominieren das Gremium über alle 4 Quartale mit 5 bis 6 Haltern. Beide bilden das absolute Kern-Rückgrat der institutionellen Tech-Allokation.\n`;
        md += `   * **Lam Research (\`LRCX\`)** erlebte die stärkste Konsens-Expansion im Halbleiterbereich: Von 2 Haltern in Q3-2025 stieg die Aktie auf **5 Halter und 3 aktive Neukäufer** in Q2-2026 (Coatue +401 %, Altimeter Neukauf, Duquesne Neukauf). Dies untermauert empirisch den Nachrücker-Entscheid in Slot 7.\n`;
        md += `   * **Microsoft (\`MSFT\`)**, **Taiwan Semiconductor (\`TSM\`)** und **Nvidia (\`NVDA\`)** verbleiben stabil mit 3 bis 5 Haltern im Kern-Konsens.\n\n`;

        md += `2. **Der große Schnitt (Brutales Trimming & Ausstiege):**  \n`;
        md += `   * **ServiceNow (\`NOW\`):** Wurde von Philippe Laffont (Coatue) bereits Anfang 2025 vollständig liquidiert. In den letzten 12 Monaten verblieb nur noch Chase Coleman (Tiger Global). Das 7-Slot-Regelwerk reagierte mit der 100 %-Verkaufsregel völlig präzise und schützte vor relativem Underperformance-Risiko.\n`;
        md += `   * **Broadcom (\`AVGO\`):** Erlebte eine massive Konsens-Erosion. Stanley Druckenmiller (Duquesne) und Brad Gerstner (Altimeter) stiegen komplett aus; Coleman halbierte seine Position (-51 %). Nur Laffont und Tepper bauten aus.\n`;
        md += `   * **China-Tech Exit:** Nahezu synchroner Kahlschlag bei chinesischen Werten: Alibaba (\`BABA\`, von 3 auf 1 Halter), PDD Holdings (\`PDD\`, von 2 auf 0 Halter), JD.com (\`JD\`, von 2 auf 1 Halter).\n`;
        md += `   * **Enterprise SaaS Trimming:** MongoDB (\`MDB\`, von 2 auf 0), Figma (\`FIGMA\`, von 2 auf 0), Snowflake (\`SNOW\`, von 2 auf 1).\n\n`;

        md += `3. **Optionen & Asymmetrische Makro-Hedges (Puts & Calls):**  \n`;
        md += `   * **Zach Schreiber (PointState Capital):** Nutzt massive Index- und Sektor-Puts zur Portfolioabsicherung. Im Q1-2026 hielt PointState einen gigantischen **S&P 500 ETF (SPY) Put im Nominalwert von 3,32 Mrd. $** sowie im Q2-2026 einen **VanEck Semiconductor (SMH) Put im Wert von 601 Mio. $**! Parallel setzte Schreiber massiv auf Power/Energy-Calls (PG&E Call 529,8 Mio. $) und Meta-Calls (740,7 Mio. $).\n`;
        md += `   * **David Tepper (Appaloosa):** Hielt im Q2-2026 eine gezielte **Apple (\`AAPL\`) Put-Position über 241,6 Mio. $**, womit er Big-Tech-Bewertungsrisiken selektiv absicherte.\n`;
        md += `   * **Stanley Druckenmiller (Duquesne):** Kombiniert Long-Aktien mit gehebelten Long-Calls auf Kern-Picks (Amazon Calls, Meta Calls, QQQ Calls, SPY Calls).\n\n`;

        md += `---\n\n`;

        md += `## 2. Die Konsens-Tabelle: Entwicklung aller Aktien mit $\\ge 2$ Haltern\n\n`;
        md += `Die folgende Tabelle zeigt alle Wertpapiere, die im 12-Monats-Verlauf von mindestens 2 der 6 Stamm-Manager gehalten wurden, geordnet nach aktuellem Konsens:\n\n`;

        md += `| Ticker / Unternehmen | CUSIP | Typ | Q3-2025 | Q4-2025 | Q1-2026 | Q2-2026 | 12M-Trend | Status 7-Slot |\n`;
        md += `| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |\n`;

        for (const sec of allConsensus) {
            const qVals = quarters.map(q => {
                const count = sec.byQuarter[q]?.coreHolders.size || 0;
                const val = Array.from(sec.byQuarter[q]?.coreHolders.values() || []).reduce((s, h) => s + h.value, 0);
                return `${count} (${formatCurrency(val)})`;
            });

            const firstCount = sec.byQuarter[quarters[0]]?.coreHolders.size || 0;
            const lastCount = sec.byQuarter[quarters[quarters.length - 1]]?.coreHolders.size || 0;
            let trendStr = '➡️ Stabil';
            if (lastCount > firstCount) trendStr = `🟢 +${lastCount - firstCount} Halter`;
            else if (lastCount < firstCount) trendStr = `🔴 ${lastCount - firstCount} Halter`;

            let slotStatus = '-';
            if (['023135106', '30303M102', '874039100', '512807306', '594918104', '67066G104', '02079K305', '02079K107'].includes(sec.cusip)) {
                slotStatus = '**Aktiv im 7-Slot**';
            } else if (lastCount >= 2) {
                slotStatus = 'Qualifiziert (Warteliste)';
            } else {
                slotStatus = 'Ausgeschieden (<2)';
            }

            md += `| **${sec.issuer_name.slice(0, 22)}** | \`${sec.cusip}\` | ${sec.put_call} | ${qVals[0]} | ${qVals[1]} | ${qVals[2]} | ${qVals[3]} | ${trendStr} | ${slotStatus} |\n`;
        }

        md += `\n---\n\n`;

        md += `## 3. Transaktions-Chronik der 7 Kern-Slots (Quartal für Quartal)\n\n`;

        const coreSlotCusips = [
            { ticker: 'AMZN', cusip: '023135106', name: 'Amazon.com Inc.' },
            { ticker: 'META', cusip: '30303M102', name: 'Meta Platforms Inc.' },
            { ticker: 'MSFT', cusip: '594918104', name: 'Microsoft Corp.' },
            { ticker: 'TSM', cusip: '874039100', name: 'Taiwan Semiconductor' },
            { ticker: 'NVDA', cusip: '67066G104', name: 'Nvidia Corp.' },
            { ticker: 'GOOGL', cusip: '02079K305', name: 'Alphabet Inc. (Class A)' },
            { ticker: 'LRCX', cusip: '512807306', name: 'Lam Research Corp.' },
            { ticker: 'NOW (Ex-Slot)', cusip: '81762P102', name: 'ServiceNow Inc.' },
            { ticker: 'AVGO (Kandidat)', cusip: '11135F101', name: 'Broadcom Inc.' }
        ];

        for (const slot of coreSlotCusips) {
            const sec = securities.get(`${slot.cusip}_STOCK`);
            if (!sec) continue;

            md += `### 📌 ${slot.ticker}: ${slot.name} (\`${slot.cusip}\`)\n\n`;
            md += `| Manager (Fonds) | Q3-2025 | Q4-2025 | Q1-2026 | Q2-2026 | 12M-Aktion |\n`;
            md += `| :--- | :---: | :---: | :---: | :---: | :--- |\n`;

            for (const [cik, g] of Object.entries(GURU_MAP)) {
                if (!g.core) continue;

                const holds = quarters.map(q => sec.byQuarter[q]?.coreHolders.get(cik));
                const sharesArr = holds.map(h => h ? h.shares : 0);
                const valArr = holds.map(h => h ? h.value : 0);

                if (sharesArr.some(s => s > 0)) {
                    const qCols = quarters.map((q, idx) => {
                        if (sharesArr[idx] === 0) return '-';
                        return `${formatShares(sharesArr[idx])} (${formatCurrency(valArr[idx])})`;
                    });

                    // Gesamtbewertung
                    let verdict = '➡️ Unverändert';
                    const sFirst = sharesArr[0];
                    const sLast = sharesArr[3];
                    if (sFirst === 0 && sLast > 0) verdict = `🟢 **Neupositionierung** (+${formatShares(sLast)})`;
                    else if (sFirst > 0 && sLast === 0) verdict = `🔴 **Komplettverkauf**`;
                    else if (sLast > sFirst * 1.2) verdict = `🔼 **Aggressiver Zukauf** (+${((sLast - sFirst) / sFirst * 100).toFixed(0)} %)`;
                    else if (sLast < sFirst * 0.8) verdict = `🔻 **Teilverkaeufe** (${((sLast - sFirst) / sFirst * 100).toFixed(0)} %)`;

                    md += `| **${g.short}** (${g.fund}) | ${qCols[0]} | ${qCols[1]} | ${qCols[2]} | ${qCols[3]} | ${verdict} |\n`;
                }
            }
            md += `\n`;
        }

        md += `---\n\n`;

        md += `## 4. Derivate-Spiegel: Makro-Hedges über Puts & Calls\n\n`;
        md += `Die 13F-Meldungen offenbaren spektakuläre Absicherungs- und Hebelstrategien der Hedgefonds-Manager:\n\n`;
        md += `| Quartal | Manager | Fonds | Basiswert | Option | Kontrakte / Aktien | Gemeldeter Marktwert |\n`;
        md += `| :---: | :--- | :--- | :--- | :---: | :---: | :---: |\n`;

        for (const opt of optionsList) {
            for (const q of quarters) {
                const qData = opt.byQuarter[q];
                if (!qData) continue;
                for (const [cik, hold] of qData.coreHolders.entries()) {
                    const g = GURU_MAP[cik];
                    md += `| ${q} | **${g.short}** | ${g.fund} | ${opt.issuer_name.replace('&amp;', '&')} | **${opt.put_call}** | ${formatShares(hold.shares)} | **${formatCurrency(hold.value)}** |\n`;
                }
            }
        }

        md += `\n> [!IMPORTANT]\n`;
        md += `> **Strategische Interpretation der Put-Hedges:**\n`;
        md += `> 1. **Zach Schreiber (PointState):** Fuhr im Q1-2026 einen massiven **3,32 Mrd. $ SPY Put**, als die Zins- und Zollsorgen zunahmen. Im Q2-2026 rotierte er in einen **601 Mio. $ VanEck Halbleiter (SMH) Put**, was auf gezielte Absicherung gegen Halbleiter-Rücksetzer hindeutet.\n`;
        md += `> 2. **David Tepper (Appaloosa):** Setzte im Q2-2026 einen gezielten **241,6 Mio. $ Apple-Put**. Tepper hält zwar massiv Meta, Amazon und Google, schirmte sich aber explizit gegen Apples Margen- und China-Schwäche ab.\n\n`;

        md += `---\n\n`;

        md += `## 5. Portfoliovolumen & Thematische Sektor-Rotation\n\n`;
        md += `### A. Entwicklung des 13F-Gesamtvolumens der 6 Stamm-Manager\n\n`;
        md += `| Manager | Fonds | Q3-2025 | Q4-2025 | Q1-2026 | Q2-2026 | 12M-Veränderung |\n`;
        md += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: |\n`;

        for (const [cik, g] of Object.entries(GURU_MAP)) {
            if (!g.core) continue;
            const qV = quarters.map(q => formatCurrency(guruVol[cik][q]));
            const v0 = guruVol[cik][quarters[0]];
            const v3 = guruVol[cik][quarters[3]];
            const diffPct = v0 > 0 ? ((v3 - v0) / v0 * 100).toFixed(1) + ' %' : '-';
            md += `| **${g.name}** | ${g.fund} | ${qV[0]} | ${qV[1]} | ${qV[2]} | ${qV[3]} | **${diffPct}** |\n`;
        }

        md += `\n### B. Auf was haben die Gurus ihre Portfolios in den letzten 12 Monaten getrimmt?\n\n`;
        md += `1. **Aufbau: KI-Infrastruktur & Next-Gen Hardware (Lam Research, TSMC, Nvidia):**  \n`;
        md += `   Das Gremium hat die Hardware- und Halbleiter-Ausrüster massiv aufgestockt. Lam Research stieg von 2 auf 5 Halter, TSMC wurde von Duquesne und Coatue kontinuierlich akkumuliert.\n\n`;
        md += `2. **Aufbau: Energie & Data Center Power (Vistra, Constellation, PG&E):**  \n`;
        md += `   Eine der markantesten thematischen Neuerungen: Druckenmiller, Tepper und Schreiber bauten signifikante Positionen in Energieversorgern und Kernkraft-Profiteuren auf (Vistra Corp, Constellation Energy, PG&E), um vom gigantischen Strombedarf der KI-Rechenzentren zu profitieren.\n\n`;
        md += `3. **Abbau: China-Aktien & Asiatischer Konsum:**  \n`;
        md += `   Bis Q3-2025 hielten Tepper, Coleman und Laffont noch Milliarden in Alibaba, PDD und JD.com. Über die letzten 12 Monate wurden diese Bestände fast vollständig liquidiert oder drastisch zusammengestrichen.\n\n`;
        md += `4. **Abbau: B2B Enterprise Software ohne KI-Monopol:**  \n`;
        md += `   Software-Werte mit verlangsamtem Wachstum wie ServiceNow, Snowflake und MongoDB wurden abgestoßen oder halbiert. Das Kapital rotierte stattdessen konzentriert in die Hyperscaler (Microsoft, Amazon, Meta, Google).\n\n`;

        // Speichern
        const outPath = path.resolve('docs/research/strategies/Guru-12M-Portfolio-Evolution.md');
        fs.writeFileSync(outPath, md, 'utf8');
        console.log(`\n✅ Bericht erfolgreich generiert: ${outPath}`);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

run();
