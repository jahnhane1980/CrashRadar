import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { Logger } from '../../Logger.js';

export class SecEdgar13FFetchAdapter {
    constructor() {
    }

    // Hilfsfunktion: Wartet x Millisekunden (wichtig für SEC Rate Limit 10/sec)
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetch(task, provider, startDate, requestManager) {
        Logger.info(`[SecEdgar13F] Hole 13F Holdings (Zeitraum ab: ${startDate || 'Beginn'})`);
        
        // 1. Config laden
        const configPath = path.join(process.cwd(), 'config', 'Smart-Money-Config.json');
        if (!fs.existsSync(configPath)) {
            throw new Error(`Config-Datei nicht gefunden: ${configPath}`);
        }
        
        const smartMoneyConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const allRecords = [];

        // B2 Chunking: Wenn die Config einen speziellen Fonds anfragt, verarbeiten wir nur diesen.
        const ciksToProcess = (task.params && task.params.cik) 
            ? { [task.params.cik]: smartMoneyConfig[task.params.cik] }
            : smartMoneyConfig;

        // 2. Alle angefragten Fonds durchgehen
        for (const [cik, fundInfo] of Object.entries(ciksToProcess)) {
            Logger.info(`\n[SecEdgar13F] Prüfe Filings für ${fundInfo.name} (CIK: ${cik})`);
            
            try {
                // 2.1 Submissions JSON holen
                const subUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
                const subJsonText = await requestManager.fetch(subUrl, provider, {
                    responseType: 'text',
                    headers: { 'User-Agent': 'CrashRadar Research (research@example.com)' }
                });
                const subJson = JSON.parse(subJsonText);
                await this.wait(200); // Rate Limit Schutz
                
                const forms = subJson.filings.recent.form;
                const accNos = subJson.filings.recent.accessionNumber;
                const filingDates = subJson.filings.recent.filingDate;
                const reportDates = subJson.filings.recent.reportDate;
                
                // Wir sammeln alle 13F-HR und Korrekturen (13F-HR/A), die NACH dem startDate gemeldet wurden
                const targetFilings = [];
                for(let i = 0; i < forms.length; i++) {
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

                Logger.info(`[SecEdgar13F] Gefundene neue 13F-HR Filings für ${fundInfo.name}: ${targetFilings.length}`);

                // 2.2 Für jedes gefundene Filing die Holdings holen
                for (const filing of targetFilings) {
                    const rawCik = parseInt(cik, 10).toString(); // Führende Nullen entfernen
                    const accNoClean = filing.accessionNumber.replace(/-/g, '');
                    
                    // Index JSON holen, um den genauen XML Dateinamen zu finden
                    const indexUrl = `https://www.sec.gov/Archives/edgar/data/${rawCik}/${accNoClean}/index.json`;
                    const indexJsonText = await requestManager.fetch(indexUrl, provider, {
                        responseType: 'text',
                        headers: { 'User-Agent': 'CrashRadar Research (research@example.com)' }
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
                        headers: { 'User-Agent': 'CrashRadar Research (research@example.com)' }
                    });
                    await this.wait(200);

                    // 3. XML auf Festplatte schreiben und speicherschonend parsen
                    const tempFilePath = path.join(os.tmpdir(), `13f_${cik}_${filing.reportDate}_${Date.now()}.xml`);
                    fs.writeFileSync(tempFilePath, xmlText);
                    
                    try {
                        const parsedHoldings = await this.parseXmlStream(tempFilePath, filing.reportDate, filing.filingDate, cik);
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

    // Liest die Datei zeilenweise, was den RAM extrem schont (egal ob XML 1 MB oder 50 MB groß ist)
    async parseXmlStream(filePath, reportDate, filingDate, cik) {
        const holdings = [];
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        let inInfoTable = false;
        let block = '';

        for await (const line of rl) {
            if (line.includes('<infoTable') || line.includes('<ns1:infoTable')) {
                inInfoTable = true;
                block = line;
            } else if (inInfoTable) {
                block += '\n' + line;
                if (line.includes('</infoTable>') || line.includes('</ns1:infoTable>')) {
                    inInfoTable = false;
                    
                    // Namespaces entfernen
                    const cleanBlock = block.replace(/<[a-zA-Z0-9]+:/g, '<').replace(/<\/[a-zA-Z0-9]+:/g, '</');
                    
                    const nameMatch = cleanBlock.match(/<nameOfIssuer>([^<]+)<\/nameOfIssuer>/i);
                    const cusipMatch = cleanBlock.match(/<cusip>([^<]+)<\/cusip>/i);
                    const valueMatch = cleanBlock.match(/<value>([^<]+)<\/value>/i);
                    const sharesMatch = cleanBlock.match(/<sshPrnamt>([^<]+)<\/sshPrnamt>/i);
                    const putCallMatch = cleanBlock.match(/<putCall>([^<]+)<\/putCall>/i);

                    // Wir überspringen leere oder fehlerhafte Blöcke (Chaos-Protection)
                    if (cusipMatch && valueMatch && sharesMatch) {
                        holdings.push({
                            cik: cik,
                            report_date: reportDate,
                            filing_date: filingDate,
                            cusip: cusipMatch[1].trim(),
                            put_call: putCallMatch ? putCallMatch[1].trim().toUpperCase() : 'STOCK',
                            issuer_name: nameMatch ? nameMatch[1].trim() : null,
                            shares: parseInt(sharesMatch[1], 10) || 0,
                            value: parseInt(valueMatch[1], 10) || 0
                        });
                    }
                    block = ''; // Reset für den nächsten infoTable Block
                }
            }
        }
        return holdings;
    }
}
