# Tracker

Product owner: gamaoff. Status as of 2026-10-27. Repo is public (changed 2026-10-27).

Priority labels: P0 blocks everything, P1 next, P2 later. Status: done, open, blocked.

## 1. Privacy review before anything is shared (P0)

Rule: nothing goes into this repo that identifies the owner beyond the public GitHub handle `gamaoff`, and nothing that is real transaction data.

Audit of 2026-10-27, scope: 43 tracked files plus commit metadata.

| Check | Result |
|---|---|
| Personal e-mail, phone, address, tax ID, IBAN in files | none found |
| Tokens, keys, secrets in files | none found |
| Local paths (`/home`, `/root`, `/mnt`) in files | none found |
| Crypto addresses (0x, bc1, legacy BTC) | none found |
| Commit author and committer e-mail | GitHub noreply only |
| Sample data | 78 synthetic rows, no real wallets or notes |
| Screenshots | metadata empty, show sample data only |
| `dist/` and `node_modules/` | ignored, not tracked |

Open decisions and tasks:

| # | Item | Priority | Status |
|---|---|---|---|
| 1.1 | Commit message carried a `Claude-Session` link to a claude.ai session. Removed from history on 2026-10-27 (commit rewritten, force push). Still check the sharing setting of that session in claude.ai. | P0 | done, see 1.7 |
| 1.2 | Real name removed from commits, files and screenshots on 2026-10-27. Everything uses the handle `gamaoff` and a noreply e-mail. The initial commit has GitHub display name "gama". | P0 | done |
| 1.9 | Copyright holder is the handle `gamaoff`. Before selling a commercial license, replace it with your legal name or a company, so the ownership is provable. | P1 | open |
| 1.3 | Add `scripts/privacy-check.mjs` and run it in CI: fails on e-mail patterns, local paths, session links, `0x` addresses, and any CSV in the repo other than `sample/`. | P1 | open |
| 1.4 | Add to `.gitignore`: `*.csv` except `sample/`, `*.xlsx`, `.env*`, `private/`. Protects against accidentally committing a real export. | P1 | open |
| 1.5 | Re-run the audit on the full history, not only on the current tree. Repo is already public, so do it now and before every release. | P0 | open |
| 1.6 | License: AGPL-3.0-or-later, copyright held by gamaoff alone, so a commercial license can be offered later. Versions already published stay AGPL. Needs a contributor agreement before accepting outside code. | P1 | done |
| 1.7 | Repo is already public. Old commit `cf936da` (with the session link) stays reachable by hash and in forks or caches after the rewrite. Fully removing it means GitHub support or deleting and recreating the repo. | P0 | open |
| 1.8 | Write the contributor agreement (CLA) before the first outside pull request. | P2 | open |

## 2. Done

| Item | Note |
|---|---|
| PRD with roadmap | Claude Docs artifact |
| Engine | Dec fixed-point, per-wallet FIFO, § 23 and § 22 Nr. 3 EStG, draft scenario of 30.09.2026 |
| Tests | 38 passing, expectations calculated by hand |
| UI | Import, review, tax year, holdings, simulator, privacy view, DE and EN |
| Privacy enforcement | CSP `connect-src 'none'`, 3 requests on load, nothing persisted |
| Repo on GitHub | `gamaoff/Krypto-steuer-lokal`, 2 commits on `main` |

## 3. Next

| # | Item | Priority | Status |
|---|---|---|---|
| 3.1 | Read the first CI run. It is the first typecheck against real React types. Fix whatever fails. | P1 | open |
| 3.2 | 8 user interviews with private investors in Germany, per PRD. Validate the claim that privacy is the main value for non-technical users. | P1 | open |
| 3.3 | Usability test with 5 users on the import to Anlage SO flow. | P1 | open |
| 3.4 | Parser for Bitpanda export. | P1 | open |
| 3.5 | Parsers for Kraken and Coinbase. | P2 | open |
| 3.6 | Review the tax rules with a Steuerberater. Today they are implemented from the sources in `rules.ts`, not verified by a professional. | P1 | open |
| 3.7 | Encrypted local persistence. Needs a design first (CLAUDE.md invariant 2). | P2 | open |
| 3.8 | Tauri desktop build. | P2 | open |
| 3.9 | GitHub Pages deploy. Needs a public repo or a paid plan. Depends on 1.5. | P2 | blocked by 1.5 |

## 4. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Tax rules wrong or outdated | Users file with these numbers | 3.6, every rule cites a source, versioned in `rules.ts` |
| Reform draft of 30.09.2026 is not law | Showing it as fact would mislead | Modeled as a scenario only, labeled in the UI |
| Real data in the repo | Breaks the product promise | Section 1 |
| Privacy claim untested with real users | The core assumption of the product | 3.2 and 3.3 |
| Missing cost data in imports | Conservative handling (cost 0) raises the tax shown | Review screen flags it, parsers in 3.4 and 3.5 reduce it |
