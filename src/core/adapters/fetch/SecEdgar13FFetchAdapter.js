import fs from 'fs';
import path from 'path';
import os from 'os';
import { Logger } from '../../Logger.js';
import { Sec13FXmlParser } from '../../parsers/Sec13FXmlParser.js';

export class SecEdgar13FFetchAdapter {
    constructor() {
        this.parser = new Sec13FXmlParser();
    }

    // Hilfsfunktion: Wartet x Millisekunden (wichtig für SEC Rate Limit 10/sec)
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetch(task, provider, startDate, requestManager, storage = null) {
        Logger.info(`[SecEdgar13F] Hole 13F Holdings (Zeitraum ab: ${startDate || 'Beginn'})`);
        
        // 1. Config laden
        const configPath = path.join(process.cwd(), 'config', 'Smart-Money-Config.json');
        if (!fs.existsSync(configPath)) {
            throw new Error(`Config-Datei nicht gefunden: ${configPath}`);
        }
        
        const smartMoneyConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const allRecords = [];

        // 2. Ziel-Fonds filtern: nach CIK, nach Strategie oder alle aktiven
        let ciksToProcess = {};
        if (task.params && task.params.cik) {
            ciksToProcess = { [task.params.cik]: smartMoneyConfig[task.params.cik] };
        } else if (task.params && task.params.strategy) {
            const strat = task.params.strategy;
            for (const [cik, info] of Object.entries(smartMoneyConfig)) {
                if (info && info.active !== false && (info.strategies?.includes(strat) || info.strategy === strat)) {
                    ciksToProcess[cik] = info;
                }
            }
        } else {
            for (const [cik, info] of Object.entries(smartMoneyConfig)) {
                if (info && info.active !== false) {
                    ciksToProcess[cik] = info;
                }
            }
        }

        const pool = storage?.pool || null;

        // 3. Alle angefragten Fonds durchgehen
        for (const [cik, fundInfo] of Object.entries(ciksToProcess)) {
            if (!fundInfo) continue;
            Logger.info(`\n[SecEdgar13F] Prüfe Filings für ${fundInfo.name} (CIK: ${cik})`);
            
            try {
                // 3.1 Submissions JSON holen
                const paddedCik = cik.padStart(10, '0');
                const subUrl = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;
                const subJsonText = await requestManager.fetch(subUrl, provider, {
                    responseType: 'text',
                    headers: { 'User-Agent': 'CrashRadar Research (research@crashradar.org)' }
                });
                const subJson = JSON.parse(subJsonText);
                await this.wait(200); // Rate Limit Schutz
                
                const forms = subJson.filings.recent.form;
                const accNos = subJson.filings.recent.accessionNumber;
                const filingDates = subJson.filings.recent.filingDate;
                const reportDates = subJson.filings.recent.reportDate;
                
                // Wir sammeln alle 13F-HR und Korrekturen (13F-HR/A), die NACH dem startDate gemeldet wurden
                const targetFilings = [];
                for (let i = 0; i < forms.length; i++) {
                    if (forms[i] === '13F-HR' || forms[i] === '13F-HR/A') {
                        const rDate = reportDates[i];
                        if (!startDate || rDate >= startDate) {
                            targetFilings.push({
                                accessionNumber: accNos[i],
                                filingDate: filingDates[i],
                                reportDate: rDate
                            });
                        }
                    }
                }

                if (targetFilings.length === 0) {
                    Logger.info(`[SecEdgar13F] Keine neuen 13F-HR Filings seit ${startDate} für ${fundInfo.name}.`);
                    continue;
                }

                // 3.2 Fail-Safe DB-Guard: Bereits in DB vorhandene Filings ermitteln
                const existingFilings = new Set();
                if (pool) {
                    try {
                        const [rows] = await pool.query(
                            'SELECT DISTINCT report_date, filing_date FROM fund_13f_holdings WHERE cik = ?',
                            [cik]
                        );
                        for (const r of rows) {
                            const rDateStr = r.report_date instanceof Date 
                                ? r.report_date.toISOString().split('T')[0] 
                                : String(r.report_date).split('T')[0];
                            const fDateStr = r.filing_date instanceof Date 
                                ? r.filing_date.toISOString().split('T')[0] 
                                : String(r.filing_date).split('T')[0];
                            existingFilings.add(`${rDateStr}_${fDateStr}`);
                        }
                    } catch (dbErr) {
                        Logger.warn(`[SecEdgar13F] DB-Guard Lookup fehlgeschlagen (${dbErr.message}), fahre ohne Cache fort.`);
                    }
                }

                Logger.info(`[SecEdgar13F] Gefundene neue 13F-HR Filings für ${fundInfo.name}: ${targetFilings.length}`);

                // 3.3 Für jedes gefundene Filing die Holdings holen (sofern noch nicht in DB)
                for (const filing of targetFilings) {
                    const filingKey = `${filing.reportDate}_${filing.filingDate}`;
                    if (existingFilings.has(filingKey)) {
                        Logger.info(`[SecEdgar13F] ⏭️ Filing ${filing.reportDate} (${filing.filingDate}) für ${fundInfo.name} bereits in DB. Überspringe.`);
                        continue;
                    }

                    const rawCik = parseInt(cik, 10).toString(); // Führende Nullen entfernen für SEC Archiv-Pfad
                    const accNoClean = filing.accessionNumber.replace(/-/g, '');
                    
                    // Index JSON holen, um den genauen XML Dateinamen zu finden
                    const indexUrl = `https://www.sec.gov/Archives/edgar/data/${rawCik}/${accNoClean}/index.json`;
                    const indexJsonText = await requestManager.fetch(indexUrl, provider, {
                        responseType: 'text',
                        headers: { 'User-Agent': 'CrashRadar Research (research@crashradar.org)' }
                    });
                    const indexJson = JSON.parse(indexJsonText);
                    await this.wait(200);

                    let holdingXmlFile = null;
                    for (const file of indexJson.directory.item) {
                        // SEC Holdings XML heissen meist .xml, aber nicht primary_doc.xml
                        if (file.name.endsWith('.xml') && !file.name.includes('primary')) {
                            holdingXmlFile = file.name;
                            break;
                        }
                    }

                    if (!holdingXmlFile) {
                        Logger.warn(`[SecEdgar13F] ⚠️ Keine Holdings-XML gefunden in ${filing.accessionNumber}`);
                        continue;
                    }

                    // XML Herunterladen
                    const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${rawCik}/${accNoClean}/${holdingXmlFile}`;
                    const xmlText = await requestManager.fetch(xmlUrl, provider, {
                        responseType: 'text',
                        headers: { 'User-Agent': 'CrashRadar Research (research@crashradar.org)' }
                    });
                    await this.wait(200);

                    // 4. XML auf Festplatte schreiben und speicherschonend via Sec13FXmlParser streamen
                    const tempFilePath = path.join(os.tmpdir(), `13f_${cik}_${filing.reportDate}_${Date.now()}.xml`);
                    fs.writeFileSync(tempFilePath, xmlText);
                    
                    try {
                        const parsedHoldings = await this.parser.parseStream(tempFilePath, {
                            cik: cik,
                            reportDate: filing.reportDate,
                            filingDate: filing.filingDate
                        });
                        allRecords.push(...parsedHoldings);
                        Logger.info(`[SecEdgar13F] 🐋 ${fundInfo.name} [${filing.reportDate}]: ${parsedHoldings.length} Positionen geparst.`);
                    } finally {
                        if (fs.existsSync(tempFilePath)) {
                            fs.unlinkSync(tempFilePath);
                        }
                    }
                }

            } catch (err) {
                Logger.error(`[SecEdgar13F] Fehler bei Fonds ${fundInfo.name} (${cik}): ${err.message}`);
                // Wir werfen hier keinen globalen Fehler, damit andere Fonds weiterlaufen!
            }
        }

        return allRecords;
    }

    // Abwärtskompatibilitäts-Wrapper für Tests und Direktaufrufer
    async parseXmlStream(filePath, reportDate, filingDate, cik) {
        return this.parser.parseStream(filePath, reportDate, filingDate, cik);
    }
}
