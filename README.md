# Congress Stock Disclosure Tracker

A TypeScript data pipeline for tracking publicly reported congressional Periodic Transaction Reports (PTRs) with source-document audit trails.

The current MVP targets official House and Senate disclosure sources, local raw-file storage, text/PDF parsing, and local Postgres loading. It does not yet implement annual disclosures, holdings inference, market enrichment, legislation matching, reports, or a dashboard.

## Legal And Use Limits

Financial disclosure reports include statutory use restrictions. Do not use this project for unlawful purposes, commercial solicitation, credit decisions, or other prohibited uses described by the official disclosure sites. This project is intended for civic-data analysis and source-auditable public-interest reporting.

## Setup

Install dependencies:

```sh
npm install
```

Create local environment configuration:

```sh
cp .env.example .env
```

Set `DATABASE_URL` to a local Postgres database, for example:

```sh
DATABASE_URL=postgres://postgres:postgres@localhost:5432/congress_disclosures
```

PDF parsing uses the local `pdftotext` command when parsing downloaded PDFs. On macOS, install it with:

```sh
brew install poppler
```

## Commands

Migrate the database and seed reference rows:

```sh
npm run dev -- migrate
```

Collect House PTR documents for a year. This uses the official House yearly financial disclosure index to find PTR filings and download the linked PTR PDFs:

```sh
npm run dev -- collect --source house --year 2025 --limit 10
```

Collect Senate PTR documents from known official download URLs:

```sh
npm run dev -- collect --source senate --year 2025 --url "https://efdsearch.senate.gov/..."
```

Parse collected documents:

```sh
npm run dev -- parse --source house --year 2025
```

Load parsed documents into Postgres:

```sh
npm run dev -- load --source house --year 2025
```

Run collect, parse, migrate/seed, and load together:

```sh
npm run dev -- run-pipeline --source house --year 2025 --limit 10
```

## Data Layout

Raw downloaded files and collection manifests are stored under:

```text
data/raw/<source>/<year>/
```

Parsed batches are stored under:

```text
data/processed/<source>/<year>/parsed-ptrs.json
```

These paths are ignored by Git and can be changed with `RAW_DATA_DIR` and `PROCESSED_DATA_DIR`.

## Verification

Run the standard checks:

```sh
npm test
npm run typecheck
npm run build
```

Database integration tests are skipped unless `DATABASE_URL` is set.
