/**
 * Apply manual translation overrides without calling Google.
 * Usage: node scripts/apply-overrides.mjs
 */
import XLSX from 'xlsx';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function stripNiqqud(text) {
  return text.replace(/[\u0591-\u05C7]/g, '');
}

function normalizeHe(text) {
  return stripNiqqud(text)
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .trim();
}

function applyOverrides(words) {
  const overridesPath = join(root, 'scripts', 'translation-overrides.json');
  if (!existsSync(overridesPath)) return 0;
  const overrides = JSON.parse(readFileSync(overridesPath, 'utf8'));
  let count = 0;
  for (const word of words) {
    const match = overrides.find(
      (o) => o.entry === word.entry && (o.meaning || '') === (word.meaning || '')
    );
    if (match && normalizeHe(word.translate || '') !== normalizeHe(match.translate)) {
      console.log(`  ${word.entry}: "${word.translate}" → "${match.translate}"`);
      word.translate = match.translate;
      count++;
    }
  }
  return count;
}

function updateExcel(filePath, sheetName, words, entryCol = 0, translateCol = 2) {
  if (!existsSync(filePath)) return 0;
  const lookup = new Map();
  for (const w of words) lookup.set(w.entry, w.translate);

  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  let updated = 0;
  for (let r = 1; r < rows.length; r++) {
    const entry = rows[r][entryCol]?.toString().trim();
    if (!entry) continue;
    const tr = lookup.get(entry);
    if (!tr) continue;
    const current = normalizeHe(rows[r][translateCol]?.toString() || '');
    if (current !== normalizeHe(tr)) {
      rows[r][translateCol] = tr;
      updated++;
    }
  }
  if (updated > 0) {
    wb.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(rows);
    XLSX.writeFile(wb, filePath);
  }
  return updated;
}

const elementary = JSON.parse(
  readFileSync(join(root, 'src', 'data', 'words-elementary.json'), 'utf8')
);
const middle = JSON.parse(
  readFileSync(join(root, 'src', 'data', 'words-middle.json'), 'utf8')
);

console.log('Applying manual overrides…');
const n = applyOverrides(elementary) + applyOverrides(middle);
console.log(`Fixed ${n} entries`);

writeFileSync(join(root, 'src', 'data', 'words-elementary.json'), JSON.stringify(elementary));
writeFileSync(join(root, 'src', 'data', 'words-middle.json'), JSON.stringify(middle));
writeFileSync(join(root, 'src', 'data', 'words.json'), JSON.stringify(elementary));

const e1 = updateExcel(join(root, 'LexicalBand1.xlsx'), 'All list', elementary);
const e2 = updateExcel(join(root, 'LexicalBand2.xlsx'), 'All list', middle);
console.log(`Excel updated: LexicalBand1=${e1}, LexicalBand2=${e2}`);
