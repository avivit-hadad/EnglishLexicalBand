# Lexical Band — Mobile Vocabulary Game

Learn English words from the Israel Ministry of Education Lexical Bands curriculum (~1,402 words).

## Features

- **PWA** — install on your phone home screen
- **Hebrew / English UI** — switch in Settings
- **Daily practice** — 10–15 min sessions with spaced repetition
- **My List** — add/remove personal words and practice them separately
- **Progress tracking** — streaks, band progress, weekly activity
- **Daily reminders** — browser notifications at your chosen time

## Quick start (on your phone)

### Option A — Run locally and open on phone (same Wi-Fi)

```bash
npm install
npm run import-words
npm run dev
```

The terminal shows a URL like `http://192.168.x.x:5173`. Open that address on your phone's browser, then **Add to Home Screen**.

### Option B — Deploy to Vercel (recommended for daily use)

1. Push this folder to GitHub
2. Import in [Vercel](https://vercel.com) — it auto-detects Vite
3. Open the deployed HTTPS URL on your phone → Add to Home Screen

```bash
npm run build
```

## First use

1. **Create account** — email + password (stored locally on your device by default)
2. **Onboarding** — choose UI language, reminder time, session length
3. **Start Daily Practice** — system picks words based on your progress
4. **My List** — search and add words you want to focus on

## Optional: Supabase cloud sync

To sync progress across devices, create a free [Supabase](https://supabase.com) project and add to `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Run the SQL in `supabase/migrations/001_initial.sql` in the Supabase SQL editor.

## Data source

Words are imported from `LexicalBand1.xlsx` (All list sheet). Re-import after Excel updates:

```bash
npm run import-words
```

## Tech stack

- React + TypeScript + Vite
- PWA (vite-plugin-pwa)
- react-i18next (Hebrew RTL / English)
- LocalStorage auth & progress (Supabase optional)
