# Working notes for Claude Code

Local-first crypto tax prototype for private investors in Germany. Product owner: gamaoff.

## Commands

- `npm test`: engine tests with node:test via tsx. Run after every engine change.
- `npm run typecheck`: strict TypeScript over src and test.
- `npm run build`: esbuild bundle into dist/.
- `npm run dev`: serve dist/ on localhost:5173, rebuild on change, reload by hand.
- `node scripts/make-sample.mjs`: regenerate the synthetic sample.

## Invariants, never break these

1. The page makes no network requests after load. Do not add fetch, analytics, CDNs, web fonts or remote images. The CSP in index.html stays at `connect-src 'none'`.
2. Nothing is persisted in the browser until an encrypted store is designed on purpose.
3. Money and amounts use `Dec` (BigInt, 18 decimals). Never JavaScript numbers in calculations. `toNumber()` is for display only.
4. Tax thresholds, rates and dates live in `src/engine/rules.ts` with a source. No magic numbers in engine code.
5. Every rule has a test with values calculated by hand, written before the code.
6. Never commit real transaction data. Only the synthetic sample.
7. The engine has no UI imports and no dependencies.

## Tax rules implemented

- § 23 EStG: lots FIFO per wallet, tax-free from the day after the first anniversary, Freigrenze 1,000 EUR on the net gain (less than the limit is tax-free).
- § 22 Nr. 3 EStG: rewards at market value on receipt, Freigrenze 256 EUR.
- Draft of 30.09.2026 (not law): lots acquired after 31.12.2026 would be § 20 capital income, 25 % plus Soli, 1,000 EUR allowance. Scenario only.

## Writing

User-facing text and docs: no em dashes, numerals instead of spelled-out numbers, plain words, author name "gamaoff".
