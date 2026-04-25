# Project Forward Plan

## Current Milestone

Harden the Periodic Transaction Report MVP before expanding product scope. The next meaningful milestone is a reliable local PTR pipeline for a representative House sample, a small Senate URL or text-fixture sample, and idempotent Postgres loading.

Do not start dashboard, market enrichment, legislation matching, reports, scheduled jobs, hosted deployment, annual disclosures, or holdings inference until collection, parsing, audit, and loading are reliable against representative PTR inputs.

## Operating Loop

1. Confirm a clean worktree with `git status --short`.
2. Run `npm test`, `npm run typecheck`, and `npm run build`.
3. If `DATABASE_URL` is configured, run `npm run dev -- migrate`.
4. Collect a bounded official House sample with `npm run dev -- collect --source house --year 2025 --limit 10`.
5. Parse and audit it with `npm run dev -- parse --source house --year 2025` and `npm run dev -- audit-parse --source house --year 2025`.
6. Load the parsed batch twice with `npm run dev -- load --source house --year 2025` and confirm the second load does not insert duplicate transactions.
7. Convert recurring parser failures or unusual layouts into compact tracked text fixtures under `tests/fixtures/ptr/`.
8. Fix one recurring parser failure pattern at a time and add a focused test for the fixture.

## Acceptance Criteria

- House PTR sample parses with no unexplained warnings.
- Senate fixture sample parses, or produces explicit review-worthy audit output.
- Database integration tests run when `DATABASE_URL` is set.
- Repeated loads are idempotent for source documents, disclosure reports, assets, and source-indexed transactions.
- Parser fixes are backed by tracked text fixtures and unit tests.

## Git Handoff

Commit only tracked source, test, and documentation changes. Do not force-add ignored runtime files under `data/raw/`, `data/processed/`, `.env`, logs, or build output.

Preferred commit message for this milestone:

```sh
git commit -m "Harden PTR pipeline reliability"
```
