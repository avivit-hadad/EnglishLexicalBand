/**
 * Sync Hebrew translations with Google Translate (en → he).
 * Uses entry + meaning for context when available.
 * Usage: node scripts/sync-google-translate.mjs [--dry-run] [--limit=N]
 */
import translate from 'google-translate-api-x';
import XLSX from 'xlsx';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
const delayMs = 100;

function stripNiqqud(text) {
  return text.replace(/[\u0591-\u05C7]/g, '');
}

function normalizeHe(text) {
  return stripNiqqud(text)
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .trim();
}

function cacheKey(word) {
  return `${word.entry}\n${word.meaning || ''}`;
}

function buildQuery(word) {
  const entry = word.entry.trim();
  const meaning = word.meaning?.trim();
  if (meaning) return `${entry} (${meaning})`;
  return entry;
}

function cleanGoogleResult(googleRaw, entry) {
  let t = normalizeHe(googleRaw);
  // Drop trailing English gloss in parentheses, e.g. "ו(בנוסף)" or "word (note)"
  t = t.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (/^[a-zA-Z0-9\s/?'.,!-]+$/.test(t) && t.toLowerCase() === entry.toLowerCase()) {
    return null;
  }
  if (/^[a-zA-Z0-9\s/?'.,!-]+$/.test(t) && !/[\u0590-\u05FF]/.test(t)) {
    return null;
  }
  return t;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function googleHebrew(word, retries = 3) {
  const query = buildQuery(word);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await translate(query, { from: 'en', to: 'he' });
      return cleanGoogleResult(result.text, word.entry.trim());
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(500 * attempt);
    }
  }
  return null;
}

async function buildTranslationMap(words) {
  const map = new Map();
  const cachePath = join(root, 'scripts', '.google-translate-cache.json');
  let cache = {};
  if (existsSync(cachePath)) {
    try {
      cache = JSON.parse(readFileSync(cachePath, 'utf8'));
    } catch {
      cache = {};
    }
  }

  const allKeys = [...new Set(words.map(cacheKey))];
  const missingKeys = allKeys.filter((k) => !cache[k]);
  const keys = missingKeys.slice(0, limit);
  const cachedCount = allKeys.length - missingKeys.length;

  console.log(`  Cached: ${cachedCount}, to fetch: ${keys.length}, total keys: ${allKeys.length}`);

  for (const key of allKeys) {
    if (cache[key]) map.set(key, cache[key]);
  }

  let fetched = 0;
  for (const key of keys) {
    fetched++;
    const word = words.find((w) => cacheKey(w) === key);
    if (!word) continue;
    try {
      const he = await googleHebrew(word);
      if (he) {
        cache[key] = he;
        map.set(key, he);
      }
      if (fetched % 25 === 0) {
        writeFileSync(cachePath, JSON.stringify(cache));
        console.log(`  fetched ${fetched}/${keys.length} — ${word.entry} → ${he || '(skip)'}`);
      }
      await sleep(delayMs);
    } catch (err) {
      console.warn(`  SKIP "${word.entry}": ${err.message}`);
    }
  }
  writeFileSync(cachePath, JSON.stringify(cache));
  return map;
}

function applyToWords(words, map) {
  const changes = [];
  for (const word of words) {
    const google = map.get(cacheKey(word));
    if (!google) continue;
    const current = normalizeHe(word.translate || '');
    if (current !== google) {
      changes.push({
        id: word.id,
        entry: word.entry,
        band: word.band,
        old: word.translate,
        new: google,
      });
      if (!dryRun) word.translate = google;
    }
  }
  return changes;
}

function updateExcel(filePath, sheetName, words, entryCol = 0, translateCol = 2) {
  if (!existsSync(filePath) || dryRun) return 0;
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
      word.translate = match.translate;
      count++;
    }
  }
  return count;
}

async function main() {
  console.log(dryRun ? 'DRY RUN' : 'Syncing translations from Google Translate…');

  const elementary = JSON.parse(
    readFileSync(join(root, 'src', 'data', 'words-elementary.json'), 'utf8')
  );
  const middle = JSON.parse(
    readFileSync(join(root, 'src', 'data', 'words-middle.json'), 'utf8')
  );
  const allWords = [...elementary, ...middle];

  console.log(`Total word rows: ${allWords.length}, unique keys: ${new Set(allWords.map(cacheKey)).size}`);

  const map = await buildTranslationMap(allWords);

  const elemChanges = applyToWords(elementary, map);
  const midChanges = applyToWords(middle, map);
  const overrideCount = applyOverrides(elementary) + applyOverrides(middle);
  const allChanges = [...elemChanges, ...midChanges];

  console.log(`\nChanges: ${allChanges.length} (elementary ${elemChanges.length}, middle ${midChanges.length})`);
  if (overrideCount > 0) console.log(`Manual overrides applied: ${overrideCount}`);

  if (!dryRun) {
    writeFileSync(join(root, 'src', 'data', 'words-elementary.json'), JSON.stringify(elementary));
    writeFileSync(join(root, 'src', 'data', 'words-middle.json'), JSON.stringify(middle));
    writeFileSync(join(root, 'src', 'data', 'words.json'), JSON.stringify(elementary));

    const e1 = updateExcel(join(root, 'LexicalBand1.xlsx'), 'All list', elementary);
    const e2 = updateExcel(join(root, 'LexicalBand2.xlsx'), 'All list', middle);
    console.log(`Excel rows updated: LexicalBand1=${e1}, LexicalBand2=${e2}`);
  }

  writeFileSync(
    join(root, 'scripts', 'google-translate-changes.json'),
    JSON.stringify(allChanges, null, 2)
  );

  if (allChanges.length > 0) {
    console.log('\nSample changes:');
    for (const c of allChanges.slice(0, 20)) {
      console.log(`  ${c.entry}: "${c.old}" → "${c.new}"`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
