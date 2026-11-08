# Skin Routine — Skincare Tracker PWA

A personal daily skincare tracker. Open it and it tells you what to do
*right now*: a Morning block, a Back-home (~2 PM) wash, and a Night block —
with tranexamic-acid nights scheduled for you, a product cabinet that knows
what you own / queue / finished, a missed-block catch-up question, and
streaks that reward consistency.

Built for one user (Banishwor), seeded with his real routine: oily skin,
brighter and more even tone as the goal.

## Your data stays on your device

Everything — settings, product cabinet, day history — lives in the browser's
IndexedDB on the device. Nothing is sent anywhere; there is no account and
no server. The service worker caches only the app shell, never your data.
Use **Settings → Export backup** to download a JSON snapshot, and
**Import backup** to restore it (e.g. on a new phone).

## Behaviour notes

- The current block is the latest one whose start time has passed
  (defaults: Morning 04:00, Back home 12:30, Night 17:30). Before the
  morning start, you're still in last night's Night block.
- TXA appears in the Night block only on scheduled nights
  (default Mon, Tue, Thu, Fri, Sat), with one-off "use anyway" / "skip
  tonight" overrides.
- A block counts as done when every non-optional step is ticked or
  consciously skipped; optional steps never block completion and are never
  chased by the catch-up popup.
- Starting a queued successor (e.g. PHA 3% Toner) fills its routine slot
  automatically — the toner step takes the product's name.

## Stack

React 19 + TypeScript + Vite 6, Dexie (IndexedDB), Vitest for the
behaviour rules, hand-written service worker with versioned cache +
in-app update prompt — the same patterns as Dukandar by Bani.

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # behaviour test suite (30 tests)
npm run build    # production build into dist/
```

Pushes to `main` deploy automatically to GitHub Pages via
`.github/workflows/deploy.yml`.

Live: https://banishwor.github.io/skincare-tracker/
