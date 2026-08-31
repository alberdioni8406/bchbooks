# BCHBooks

**Simple accounting software for people and businesses who use Bitcoin Cash.**

Turn BCH transactions into useful business records — without being a wallet or another blockchain explorer.

## Features (MVP)

- **Read-only** — never asks for seed phrases, private keys, or spending authorization
- Connect one or more public BCH addresses
- Scan & normalize transactions into an accounting ledger
- Historical fiat valuation (USD first; EUR, GBP, ZAR, MZN prepared)
- Automatic + rule-based categorization (deterministic, no AI)
- Dashboard with period filters (this month, last month, quarter, year)
- Monthly-style reports with CSV & print-to-PDF export
- Local-first storage (IndexedDB) — your categories & notes stay private
- Mobile-first, clean professional UI

## Quick start

```bash
cd bchbooks
npm install
npm run dev
```

Open http://localhost:3000

## Deploy (Vercel)

1. Push this repo to GitHub
2. Import the project in Vercel
3. Deploy — no environment variables required for the free MVP

## Donation address

Replace the placeholder in `src/lib/types.ts`:

```ts
export const DEFAULT_DONATION_ADDRESS = 'bitcoincash:YOUR_REAL_ADDRESS_HERE';
```

BCHBooks stays free; monetization (Pro / Business) can be added later when needed.

## Architecture

```
src/
  lib/
    bch/          # adapter (isolated from accounting)
    providers/    # provider interface
    accounting/   # normalize, periods, reports
    pricing/      # historical valuation
    storage/      # IndexedDB (local-first)
  app/api/bch/    # proxy to public BCH explorer (CORS-safe)
  components/     # UI
```

The accounting engine only sees normalized transaction objects. It never calls BCH APIs directly.

## Data provider

MVP uses bchexplorer.cash (Esplora-style) via a Next.js API route proxy. The provider layer is designed for retries, timeouts, and swapping providers later.

## Important rules

- Never invent transaction or price data — show "Unavailable" when needed
- Never recalculate historical accounting with current prices
- Public chain data ≠ private user notes/categories

## License

MIT — build freely for the BCH ecosystem.
