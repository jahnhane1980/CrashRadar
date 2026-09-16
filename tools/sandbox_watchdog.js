import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SANDBOX_DIR = path.join(ROOT_DIR, 'sandbox');

// ANSI Color Codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const GRAY = '\x1b[90m';

function getSandboxFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (entry === '.gitkeep') continue;
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getSandboxFiles(fullPath, fileList);
    } else {
      fileList.push({ fullPath, stat, relPath: path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/') });
    }
  }
  return fileList;
}

function parseHeader(content) {
  const headerMatch = content.match(/\/\*\*[\s\S]*?\*\//);
  if (!headerMatch) return null;
  const block = headerMatch[0];
  if (!block.includes('@sandbox')) return null;

  const purposeMatch = block.match(/@purpose[:\s]+([^\r\n*]+)/);
  const createdMatch = block.match(/@created[:\s]+([^\r\n*]+)/);
  const statusMatch = block.match(/@status[:\s]+([^\r\n*]+)/);

  return {
    purpose: purposeMatch ? purposeMatch[1].trim() : 'Keine Zweck-Beschreibung angegeben',
    created: createdMatch ? createdMatch[1].trim() : null,
    status: statusMatch ? statusMatch[1].trim() : 'unbekannt'
  };
}

function formatAge(mtimeMs) {
  const diffMs = Date.now() - mtimeMs;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return 'Vor wenigen Minuten';
  if (hours < 24) return `Vor ${hours} Stunde(n)`;
  const days = Math.floor(hours / 24);
  return `Vor ${days} Tag(en)`;
}

export function checkSandbox() {
  const files = getSandboxFiles(SANDBOX_DIR);
  if (files.length === 0) {
    return { ok: true, fileCount: 0 };
  }

  const border = '='.repeat(80);
  const divider = '-'.repeat(80);

  console.warn(`\n${YELLOW}${BOLD}${border}${RESET}`);
  console.warn(`${YELLOW}${BOLD}⚠️  [SANDBOX-WATCHDOG] ${files.length} UNBEREINIGTE DATEI(EN) IN /sandbox GEFUNDEN!${RESET}`);
  console.warn(`${YELLOW}${BOLD}${border}${RESET}`);
  console.warn(`${GRAY}Die Sandbox ist ein temporäres Experimentierfeld und kein Dauerparkplatz.${RESET}\n`);

  for (const file of files) {
    let content = '';
    try {
      const fd = fs.openSync(file.fullPath, 'r');
      const buffer = Buffer.alloc(4096);
      const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
      fs.closeSync(fd);
      content = buffer.toString('utf8', 0, bytesRead);
    } catch (e) {
      content = '';
    }

    const header = parseHeader(content);
    const ageStr = formatAge(file.stat.mtimeMs);

    if (header) {
      console.warn(`  ${CYAN}📄 ${file.relPath}${RESET}`);
      console.warn(`     ${GRAY}• Alter:${RESET}   ${ageStr} ${header.created ? `(erstellt: ${header.created})` : ''}`);
      console.warn(`     ${GRAY}• Zweck:${RESET}   ${BOLD}${header.purpose}${RESET}`);
      console.warn(`     ${GRAY}• Status:${RESET}  ${GREEN}${header.status}${RESET}`);
      console.warn(`     ${YELLOW}👉 AKTION: Erkenntnis nach tests/ oder tools/ überführen bzw. Datei löschen!${RESET}\n`);
    } else {
      console.warn(`  ${RED}❌ ${file.relPath}${RESET}`);
      console.warn(`     ${GRAY}• Alter:${RESET}   ${ageStr}`);
      console.warn(`     ${RED}${BOLD}• FEHLER: KEIN GÜLTIGER @sandbox-HEADER VORHANDEN!${RESET}`);
      console.warn(`     ${GRAY}• Pflicht:${RESET} Jedes Sandbox-Skript benötigt @sandbox, @purpose, @created und @status`);
      console.warn(`     ${RED}👉 AKTION: Header sofort nachpflegen oder Datei restlos löschen!${RESET}\n`);
    }
  }

  console.warn(`${YELLOW}${divider}${RESET}`);
  console.warn(`${YELLOW}Sandbox-Watchdog aktiv vor jedem Testlauf. Halte die Codebase sauber!${RESET}`);
  console.warn(`${YELLOW}${border}${RESET}\n`);

  return { ok: false, fileCount: files.length };
}

// Direktausführung via CLI / npm script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkSandbox();
}
