import fs from 'fs';
import readline from 'readline';

/**
 * Sec13FXmlParser
 * 
 * Speicherschonender zeilenweiser Stream-Parser für SEC Form 13F InfoTable XMLs.
 * Extrahiert Holdings-Positionen (CUSIP, Issuer, Shares, Value, Put/Call) und bereinigt Namespaces.
 */
export class Sec13FXmlParser {
  /**
   * Parst ein 13F-XML speicherschonend zeilenweise als Stream.
   * 
   * @param {string} filePath - Absoluter Pfad zur temporären XML-Datei
   * @param {object|string} metaOrReportDate - Metadaten { cik, reportDate, filingDate } oder reportDate als String
   * @param {string} [filingDate] - Optional wenn metaOrReportDate String ist
   * @param {string} [cik] - Optional wenn metaOrReportDate String ist
   * @returns {Promise<Array<object>>} Array von Holdings-Objekten
   */
  async parseStream(filePath, metaOrReportDate, filingDate, cik) {
    let targetReportDate;
    let targetFilingDate;
    let targetCik;

    if (typeof metaOrReportDate === 'object' && metaOrReportDate !== null) {
      targetReportDate = metaOrReportDate.reportDate || metaOrReportDate.report_date;
      targetFilingDate = metaOrReportDate.filingDate || metaOrReportDate.filing_date;
      targetCik = metaOrReportDate.cik;
    } else {
      targetReportDate = metaOrReportDate;
      targetFilingDate = filingDate;
      targetCik = cik;
    }

    const holdings = [];
    if (!fs.existsSync(filePath)) {
      return holdings;
    }

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let inInfoTable = false;
    let block = '';

    for await (const line of rl) {
      if (!inInfoTable && (line.includes('<infoTable') || line.includes('<ns1:infoTable'))) {
        inInfoTable = true;
        block = line;
      } else if (inInfoTable) {
        block += '\n' + line;
      }

      if (inInfoTable && (line.includes('</infoTable>') || line.includes('</ns1:infoTable>'))) {
        inInfoTable = false;

        // Namespaces entfernen (z. B. <ns1:nameOfIssuer> -> <nameOfIssuer>)
        const cleanBlock = block.replace(/<[a-zA-Z0-9]+:/g, '<').replace(/<\/[a-zA-Z0-9]+:/g, '</');

        const nameMatch = cleanBlock.match(/<nameOfIssuer>([^<]+)<\/nameOfIssuer>/i);
        const cusipMatch = cleanBlock.match(/<cusip>([^<]+)<\/cusip>/i);
        const valueMatch = cleanBlock.match(/<value>([^<]+)<\/value>/i);
        const sharesMatch = cleanBlock.match(/<sshPrnamt>([^<]+)<\/sshPrnamt>/i);
        const putCallMatch = cleanBlock.match(/<putCall>([^<]+)<\/putCall>/i);

        // Chaos-Protection: Nur vollständige Blöcke mit CUSIP, Value und Shares übernehmen
        if (cusipMatch && valueMatch && sharesMatch) {
          holdings.push({
            cik: targetCik,
            report_date: targetReportDate,
            filing_date: targetFilingDate,
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

    return holdings;
  }
}
