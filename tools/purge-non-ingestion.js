import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.resolve('.');
const CANDIDATES_FILE = path.join(ROOT_DIR, 'deletion_candidates.txt');
const ALLOWLIST_FILE = path.join(ROOT_DIR, 'ingestion_allowlist.txt');
const EXECUTE = process.argv.includes('--force');

function normalize(p) {
  return path.resolve(p.trim().replace(/^[\*\-\s]+/, ''));
}

if (!fs.existsSync(CANDIDATES_FILE)) {
  console.error(`Fehler: ${CANDIDATES_FILE} nicht gefunden.`);
  process.exit(1);
}

const allowlist = new Set(
  fs.existsSync(ALLOWLIST_FILE)
    ? fs.readFileSync(ALLOWLIST_FILE, 'utf8')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'))
        .map(normalize)
    : []
);

const lines = fs.readFileSync(CANDIDATES_FILE, 'utf8').split('\n');
const filesToDelete = [];
const dirsToDelete = [];
let currentSection = null;

for (const rawLine of lines) {
  const line = rawLine.trim();
  if (!line) continue;

  if (line.includes('[SAFE_DELETE_FILES]')) {
    currentSection = 'files';
    continue;
  }
  if (line.includes('[SAFE_DELETE_DIRECTORIES]')) {
    currentSection = 'dirs';
    continue;
  }
  if (line.includes('[KEPT_INGESTION_FILES]')) {
    currentSection = 'kept';
    continue;
  }

  if (currentSection === 'files' || currentSection === 'dirs') {
    const targetPath = normalize(line);

    if (allowlist.has(targetPath)) {
      console.warn(`SICHERHEITSABBRUCH: ${targetPath} steht in der Allowlist! Löschung blockiert.`);
      continue;
    }

    if (currentSection === 'files') {
      filesToDelete.push(targetPath);
    } else {
      dirsToDelete.push(targetPath);
    }
  }
}

console.log(`Gefunden: ${filesToDelete.length} Dateien, ${dirsToDelete.length} Verzeichnisse zum Löschen.`);
console.log(`Modus: ${EXECUTE ? 'LIVE-LÖSCHUNG (--force aktiv)' : 'DRY-RUN (Keine Änderungen)'}\n`);

// 1. Dateien löschen
for (const file of filesToDelete) {
  if (fs.existsSync(file)) {
    if (EXECUTE) {
      fs.unlinkSync(file);
      console.log(`Gelöscht: ${file}`);
    } else {
      console.log(`[Dry-Run] Würde löschen: ${file}`);
    }
  }
}

// 2. Verzeichnisse rekursiv aufräumen
for (const dir of dirsToDelete) {
  if (fs.existsSync(dir)) {
    if (EXECUTE) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`Verzeichnis entfernt: ${dir}`);
    } else {
      console.log(`[Dry-Run] Würde Verzeichnis entfernen: ${dir}`);
    }
  }
}

if (!EXECUTE) {
  console.log('\nUm die Löschung tatsächlich auszuführen, rufe auf:\nnode tools/purge-non-ingestion.js --force');
}