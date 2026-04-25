# Architecture Notes

## Pipeline Shape

The MVP has four explicit stages:

1. `collect`: download official PTR source documents, hash the bytes, write raw files, and create a manifest.
2. `parse`: extract text, normalize member/report/transaction fields, and write a parsed JSON batch.
3. `load`: idempotently load source documents, members, disclosure reports, assets, transactions, and audit logs.
4. `run-pipeline`: run the full local workflow for one source and year.

## Auditability

Every collected document keeps:

- Official source URL.
- Local raw storage path.
- SHA-256 hash.
- Retrieval timestamp.
- Parser version.
- Raw metadata.

Database rows loaded from parsed results retain lineage through `source_documents` and `audit_logs`.

## Source Handling

House collection scrapes official House Clerk disclosure links and downloads matching PTR PDFs for the requested year when those links are exposed in the index page. Senate collection currently requires explicit official `efdsearch.senate.gov` document URLs because the Senate public search experience is not exposed as a stable unauthenticated JSON API in this MVP.

## Parser Boundaries

The parser is text-first. It reads text, HTML, CSV, and PDF files. PDF support depends on a local `pdftotext` executable rather than adding a third-party Node PDF parser.

The parser preserves raw labels where useful and normalizes:

- Owner labels to `member`, `spouse`, `dependent_child`, `joint`, `trust`, `other`, or `unknown`.
- Transaction labels to `purchase`, `sale`, `exchange`, `partial_sale`, `other`, or `unknown`.
- Disclosure dates to ISO `YYYY-MM-DD`.
- Reported value ranges to min/max/currency/certainty.

## Current Limits

This MVP intentionally does not implement annual reports, holdings inference, market data, legislation matching, dashboards, scheduled jobs, or hosted deployment. Those should be added after PTR collection, parsing, and loading are reliable against a representative fixture corpus.
