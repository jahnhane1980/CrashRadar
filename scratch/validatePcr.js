import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pcrFilePath = path.join(__dirname, '..', 'data', 'archive', 'cboe', 'pcr.csv');

async function validatePcr() {
  console.log(`Starte Validierung für: ${pcrFilePath}`);

  if (!fs.existsSync(pcrFilePath)) {
    console.error('❌ FEHLER: pcr.csv Datei existiert nicht!');
    process.exit(1);
  }

  const content = fs.readFileSync(pcrFilePath, 'utf-8').trim();
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length === 0) {
    console.error('❌ FEHLER: Datei ist leer!');
    process.exit(1);
  }

  const header = lines[0];
  if (header !== 'record_date,total_pcr') {
    console.error(`❌ FEHLER: Unerwarteter Header: '${header}'. Erwartet: 'record_date,total_pcr'`);
    process.exit(1);
  }

  console.log('✅ Header ist korrekt.');

  let errorCount = 0;
  const seenDates = new Set();
  let prevDate = null;
  let hasHtml = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('<') || line.includes('>')) {
      hasHtml = true;
      console.error(`❌ FEHLER in Zeile ${i + 1}: HTML-Artefakte gefunden -> ${line}`);
      errorCount++;
      continue;
    }

    const parts = line.split(',');
    if (parts.length !== 2) {
      console.error(`❌ FEHLER in Zeile ${i + 1}: Falsche Spaltenanzahl -> ${line}`);
      errorCount++;
      continue;
    }

    const dateStr = parts[0];
    const pcrStr = parts[1];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      console.error(`❌ FEHLER in Zeile ${i + 1}: Ungültiges Datumsformat -> ${dateStr}`);
      errorCount++;
    }

    const pcr = parseFloat(pcrStr);
    if (isNaN(pcr) || pcr <= 0 || pcr > 10) {
      console.error(`❌ FEHLER in Zeile ${i + 1}: Ungültiger PCR Wert -> ${pcrStr}`);
      errorCount++;
    }

    if (seenDates.has(dateStr)) {
      console.error(`❌ FEHLER in Zeile ${i + 1}: Doppeltes Datum gefunden -> ${dateStr}`);
      errorCount++;
    }
    seenDates.add(dateStr);

    if (prevDate && dateStr < prevDate) {
      console.error(`❌ FEHLER in Zeile ${i + 1}: Datum nicht chronologisch -> ${dateStr} kommt nach ${prevDate}`);
      errorCount++;
    }
    prevDate = dateStr;
  }

  if (hasHtml) {
    console.error('❌ KRITISCHER FEHLER: Die Datei enthält HTML-Artefakte (womöglich eine Fehlerseite von CBOE oder Cloudflare).');
  }

  console.log('----------------------------------------------------');
  if (errorCount === 0 && !hasHtml) {
    console.log(`🎉 ERFOLG: Die pcr.csv ist absolut sauber!`);
    console.log(`📊 Valide Einträge: ${lines.length - 1} Handelstage (chronologisch geordnet).`);
    console.log(`📅 Zeitraum: ${lines[1].split(',')[0]} bis ${lines[lines.length - 1].split(',')[0]}`);
  } else {
    console.log(`⚠️ VALIDIERUNG FEHLGESCHLAGEN: Es wurden ${errorCount} Fehler gefunden.`);
  }
}

validatePcr().catch(console.error);
