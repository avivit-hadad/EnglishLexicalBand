import XLSX from 'xlsx';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'src', 'data');

function importElementary() {
  const excelPath = join(root, 'LexicalBand1.xlsx');
  if (!existsSync(excelPath)) {
    console.warn('LexicalBand1.xlsx not found — skipping elementary import');
    return [];
  }

  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets['All list'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const words = [];
  let id = 1;

  for (const row of rows.slice(1)) {
    const entry = row[0]?.toString().trim();
    if (!entry) continue;

    words.push({
      id: id++,
      entry,
      pos: row[1]?.toString().trim() || '',
      translate: row[2]?.toString().trim() || '',
      meaning: row[3]?.toString().trim() || '',
      recProd: row[4]?.toString().trim() || 'Rec',
      band: row[5]?.toString().trim() || 'Pre-Band I',
    });
  }

  return words;
}

function importMiddle() {
  const excelPath = join(root, 'LexicalBand2.xlsx');
  if (!existsSync(excelPath)) {
    console.warn('LexicalBand2.xlsx not found — skipping middle school import');
    return [];
  }

  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets['All list'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const dataRows = rows.slice(1).filter((row) => row[0]?.toString().trim());
  const third = Math.ceil(dataRows.length / 3);
  const words = [];
  let id = 1;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const entry = row[0]?.toString().trim();
    if (!entry) continue;

    const posParts = [row[1], row[4]]
      .map((v) => v?.toString().trim())
      .filter(Boolean);
    let band = 'Band II Core II';
    if (i < third) band = 'Band II Core I';
    else if (i >= third * 2) band = 'Band II Core III';

    words.push({
      id: id++,
      entry,
      pos: posParts.join(', '),
      translate: row[2]?.toString().trim() || '',
      meaning: row[5]?.toString().trim() || '',
      recProd: row[6]?.toString().trim() || 'Rec',
      band,
    });
  }

  return words;
}

mkdirSync(outDir, { recursive: true });

const elementary = importElementary();
const middle = importMiddle();

writeFileSync(join(outDir, 'words-elementary.json'), JSON.stringify(elementary, null, 0));
writeFileSync(join(outDir, 'words-middle.json'), JSON.stringify(middle, null, 0));

// Keep legacy words.json pointing to elementary for compatibility
writeFileSync(join(outDir, 'words.json'), JSON.stringify(elementary, null, 0));

console.log(`Imported ${elementary.length} elementary words → words-elementary.json`);
console.log(`Imported ${middle.length} middle school words → words-middle.json`);
