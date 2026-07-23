import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testFile = path.resolve(__dirname, '../tests/services/Fetcher.test.js');

let content = fs.readFileSync(testFile, 'utf8');

// Add import
if (!content.includes("import { Logger }")) {
  content = content.replace(
    "import { Fetcher } from '../../src/services/Fetcher.js';",
    "import { Fetcher } from '../../src/services/Fetcher.js';\nimport { Logger } from '../../src/core/Logger.js';"
  );
}

// Add spies definition
if (!content.includes("let loggerErrorSpy;")) {
  content = content.replace(
    "let mockConfig;",
    "let mockConfig;\n  let loggerWarnSpy;\n  let loggerErrorSpy;"
  );
}

// Add spies in beforeEach
if (!content.includes("loggerErrorSpy = vi.spyOn(Logger")) {
  content = content.replace(
    "vi.spyOn(console, 'warn').mockImplementation(() => {});",
    "vi.spyOn(console, 'warn').mockImplementation(() => {});\n    Logger.setLevel('DEBUG');\n    loggerWarnSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => {});\n    loggerErrorSpy = vi.spyOn(Logger, 'error').mockImplementation(() => {});"
  );
}

// Replace assertions

// 1. Package Error
content = content.replace(
  /expect\(console\.error\)\.toHaveBeenCalledWith\(expect\.stringContaining\('\[PackageFetcher Error\] Task (.*):'\),\s*'(.*)'\);/g,
  "expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[PackageFetcher Error] Task $1: $2'));"
);

// 2. Storage Error
content = content.replace(
  /expect\(console\.error\)\.toHaveBeenCalledWith\(expect\.stringContaining\('\[Storage\] Error inserting data for task (.*):'\),\s*'(.*)'\);/g,
  "expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[Storage] Error inserting data for task $1: $2'));"
);

// 3. Warning missing env var
content = content.replace(
  /expect\(console\.warn\)\.toHaveBeenCalledWith\(expect\.stringContaining\('\[Warning\] Missing environment variable (.*)'\)\);/g,
  "expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[Warning] Missing environment variable $1'));"
);

// 4. Failed entirely error
content = content.replace(
  /expect\(console\.error\)\.toHaveBeenCalledWith\(expect\.stringContaining\('\[Error\] Task (.*) failed entirely:'\),\s*(.*)\);/g,
  "expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`[Error] Task $1 failed entirely: ${$2.replace(/^'|'$/g, '').replace(/^\"|\"$/g, '')}`));"
);

// 5. API Error
content = content.replace(
  /expect\(console\.error\)\.toHaveBeenCalledWith\(expect\.stringContaining\('\[API Error\] Task (.*):'\),\s*expect\.stringContaining\('(.*)'\)\);/g,
  "expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[API Error] Task $1: $2'));"
);


fs.writeFileSync(testFile, content, 'utf8');
console.log('Test file updated successfully.');
