CREATE TABLE IF NOT EXISTS chambers (
	id BIGSERIAL PRIMARY KEY,
	code TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS data_sources (
	id BIGSERIAL PRIMARY KEY,
	name TEXT NOT NULL UNIQUE,
	base_url TEXT,
	source_type TEXT NOT NULL,
	is_official_government BOOLEAN NOT NULL,
	notes TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_documents (
	id BIGSERIAL PRIMARY KEY,
	data_source_id BIGINT NOT NULL REFERENCES data_sources(id),
	url TEXT,
	document_type TEXT NOT NULL,
	content_type TEXT,
	sha256 TEXT,
	storage_path TEXT,
	retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	source_published_at TIMESTAMPTZ,
	parser_version TEXT,
	raw_metadata JSONB,
	CONSTRAINT source_documents_location_check
		CHECK (url IS NOT NULL OR storage_path IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_source_documents_sha256
	ON source_documents (sha256);

CREATE INDEX IF NOT EXISTS idx_source_documents_data_source_retrieved
	ON source_documents (data_source_id, retrieved_at);

CREATE INDEX IF NOT EXISTS idx_source_documents_url
	ON source_documents (url);

CREATE TABLE IF NOT EXISTS members (
	id BIGSERIAL PRIMARY KEY,
	official_id TEXT,
	bioguide_id TEXT,
	full_name TEXT NOT NULL,
	first_name TEXT,
	middle_name TEXT,
	last_name TEXT,
	suffix TEXT,
	chamber_id BIGINT NOT NULL REFERENCES chambers(id),
	state CHAR(2) NOT NULL,
	district TEXT,
	party TEXT,
	official_profile_url TEXT,
	is_current BOOLEAN NOT NULL DEFAULT true,
	source_document_id BIGINT REFERENCES source_documents(id),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_members_bioguide_id
	ON members (bioguide_id);

CREATE INDEX IF NOT EXISTS idx_members_official_id
	ON members (official_id);

CREATE INDEX IF NOT EXISTS idx_members_state_district
	ON members (state, district);

CREATE INDEX IF NOT EXISTS idx_members_chamber_current
	ON members (chamber_id, is_current);

CREATE TABLE IF NOT EXISTS member_terms (
	id BIGSERIAL PRIMARY KEY,
	member_id BIGINT NOT NULL REFERENCES members(id),
	chamber_id BIGINT NOT NULL REFERENCES chambers(id),
	congress_number INTEGER,
	state CHAR(2) NOT NULL,
	district TEXT,
	party TEXT,
	start_date DATE,
	end_date DATE,
	source_document_id BIGINT REFERENCES source_documents(id)
);

CREATE INDEX IF NOT EXISTS idx_member_terms_member_dates
	ON member_terms (member_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_member_terms_congress_chamber
	ON member_terms (congress_number, chamber_id);

CREATE TABLE IF NOT EXISTS companies (
	id BIGSERIAL PRIMARY KEY,
	legal_name TEXT NOT NULL,
	common_name TEXT,
	cik TEXT,
	lei TEXT,
	sic_code TEXT,
	naics_code TEXT,
	country TEXT,
	website_url TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_legal_name
	ON companies (legal_name);

CREATE INDEX IF NOT EXISTS idx_companies_common_name
	ON companies (common_name);

CREATE INDEX IF NOT EXISTS idx_companies_cik
	ON companies (cik);

CREATE INDEX IF NOT EXISTS idx_companies_sic_code
	ON companies (sic_code);

CREATE INDEX IF NOT EXISTS idx_companies_naics_code
	ON companies (naics_code);

CREATE TABLE IF NOT EXISTS securities (
	id BIGSERIAL PRIMARY KEY,
	company_id BIGINT REFERENCES companies(id),
	ticker TEXT,
	exchange TEXT,
	security_type TEXT NOT NULL,
	currency CHAR(3) NOT NULL DEFAULT 'USD',
	figi TEXT,
	isin TEXT,
	cusip TEXT,
	is_active BOOLEAN NOT NULL DEFAULT true,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_securities_ticker_exchange
	ON securities (ticker, exchange);

CREATE INDEX IF NOT EXISTS idx_securities_company
	ON securities (company_id);

CREATE INDEX IF NOT EXISTS idx_securities_figi
	ON securities (figi);

CREATE INDEX IF NOT EXISTS idx_securities_isin
	ON securities (isin);

CREATE INDEX IF NOT EXISTS idx_securities_cusip
	ON securities (cusip);

CREATE TABLE IF NOT EXISTS assets (
	id BIGSERIAL PRIMARY KEY,
	reported_name TEXT NOT NULL,
	normalized_name TEXT,
	asset_type TEXT,
	company_id BIGINT REFERENCES companies(id),
	security_id BIGINT REFERENCES securities(id),
	confidence NUMERIC(5,4),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_reported_name
	ON assets (reported_name);

CREATE INDEX IF NOT EXISTS idx_assets_normalized_name
	ON assets (normalized_name);

CREATE INDEX IF NOT EXISTS idx_assets_company
	ON assets (company_id);

CREATE INDEX IF NOT EXISTS idx_assets_security
	ON assets (security_id);

CREATE TABLE IF NOT EXISTS disclosure_reports (
	id BIGSERIAL PRIMARY KEY,
	member_id BIGINT REFERENCES members(id),
	source_document_id BIGINT NOT NULL REFERENCES source_documents(id),
	report_type TEXT NOT NULL,
	filing_date DATE,
	period_start_date DATE,
	period_end_date DATE,
	amendment_of_report_id BIGINT REFERENCES disclosure_reports(id),
	status TEXT NOT NULL,
	extraction_confidence NUMERIC(5,4),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disclosure_reports_member_filing
	ON disclosure_reports (member_id, filing_date);

CREATE INDEX IF NOT EXISTS idx_disclosure_reports_source_document
	ON disclosure_reports (source_document_id);

CREATE INDEX IF NOT EXISTS idx_disclosure_reports_report_type
	ON disclosure_reports (report_type);

CREATE TABLE IF NOT EXISTS transactions (
	id BIGSERIAL PRIMARY KEY,
	disclosure_report_id BIGINT NOT NULL REFERENCES disclosure_reports(id),
	member_id BIGINT REFERENCES members(id),
	asset_id BIGINT REFERENCES assets(id),
	security_id BIGINT REFERENCES securities(id),
	source_transaction_index INTEGER,
	reported_owner_category TEXT,
	transaction_type TEXT NOT NULL,
	transaction_date DATE,
	filing_date DATE,
	reported_value_min NUMERIC(18,2),
	reported_value_max NUMERIC(18,2),
	reported_value_label TEXT,
	estimated_value NUMERIC(18,2),
	estimation_method TEXT,
	share_count NUMERIC(28,8),
	share_count_source TEXT,
	price_on_transaction_date NUMERIC(18,6),
	currency CHAR(3) NOT NULL DEFAULT 'USD',
	confidence NUMERIC(5,4),
	notes TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT transactions_value_range_check
		CHECK (
			reported_value_min IS NULL
			OR reported_value_max IS NULL
			OR reported_value_min <= reported_value_max
		)
);

CREATE INDEX IF NOT EXISTS idx_transactions_member_date
	ON transactions (member_id, transaction_date);

CREATE INDEX IF NOT EXISTS idx_transactions_security_date
	ON transactions (security_id, transaction_date);

CREATE INDEX IF NOT EXISTS idx_transactions_transaction_type
	ON transactions (transaction_type);

CREATE INDEX IF NOT EXISTS idx_transactions_report
	ON transactions (disclosure_report_id);

ALTER TABLE transactions
	ADD COLUMN IF NOT EXISTS source_transaction_index INTEGER;

CREATE INDEX IF NOT EXISTS idx_transactions_report_source_index
	ON transactions (disclosure_report_id, source_transaction_index);

CREATE TABLE IF NOT EXISTS holdings (
	id BIGSERIAL PRIMARY KEY,
	member_id BIGINT NOT NULL REFERENCES members(id),
	asset_id BIGINT REFERENCES assets(id),
	security_id BIGINT REFERENCES securities(id),
	owner_category TEXT,
	as_of_date DATE NOT NULL,
	share_count NUMERIC(28,8),
	share_count_basis TEXT,
	reported_value_min NUMERIC(18,2),
	reported_value_max NUMERIC(18,2),
	estimated_value NUMERIC(18,2),
	estimation_method TEXT,
	inference_level TEXT NOT NULL,
	confidence NUMERIC(5,4),
	source_document_id BIGINT REFERENCES source_documents(id),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT holdings_value_range_check
		CHECK (
			reported_value_min IS NULL
			OR reported_value_max IS NULL
			OR reported_value_min <= reported_value_max
		)
);

CREATE INDEX IF NOT EXISTS idx_holdings_member_date
	ON holdings (member_id, as_of_date);

CREATE INDEX IF NOT EXISTS idx_holdings_security_date
	ON holdings (security_id, as_of_date);

CREATE INDEX IF NOT EXISTS idx_holdings_inference_level
	ON holdings (inference_level);

CREATE TABLE IF NOT EXISTS market_prices (
	id BIGSERIAL PRIMARY KEY,
	security_id BIGINT NOT NULL REFERENCES securities(id),
	price_date DATE NOT NULL,
	open_price NUMERIC(18,6),
	high_price NUMERIC(18,6),
	low_price NUMERIC(18,6),
	close_price NUMERIC(18,6),
	adjusted_close_price NUMERIC(18,6),
	volume BIGINT,
	currency CHAR(3) NOT NULL DEFAULT 'USD',
	data_source_id BIGINT NOT NULL REFERENCES data_sources(id),
	retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (security_id, price_date, data_source_id)
);

CREATE INDEX IF NOT EXISTS idx_market_prices_date
	ON market_prices (price_date);

CREATE TABLE IF NOT EXISTS legislative_documents (
	id BIGSERIAL PRIMARY KEY,
	source_document_id BIGINT REFERENCES source_documents(id),
	external_id TEXT,
	document_type TEXT NOT NULL,
	title TEXT,
	congress_number INTEGER,
	introduced_date DATE,
	latest_action_date DATE,
	sponsor_member_id BIGINT REFERENCES members(id),
	url TEXT,
	text_hash TEXT,
	metadata JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legislative_documents_external_id
	ON legislative_documents (external_id);

CREATE INDEX IF NOT EXISTS idx_legislative_documents_congress_type
	ON legislative_documents (congress_number, document_type);

CREATE INDEX IF NOT EXISTS idx_legislative_documents_latest_action_date
	ON legislative_documents (latest_action_date);

CREATE INDEX IF NOT EXISTS idx_legislative_documents_sponsor_member
	ON legislative_documents (sponsor_member_id);

CREATE TABLE IF NOT EXISTS legislative_company_matches (
	id BIGSERIAL PRIMARY KEY,
	legislative_document_id BIGINT NOT NULL REFERENCES legislative_documents(id),
	company_id BIGINT REFERENCES companies(id),
	security_id BIGINT REFERENCES securities(id),
	match_type TEXT NOT NULL,
	matched_text TEXT,
	context_excerpt TEXT,
	relevance_score NUMERIC(5,4),
	confidence NUMERIC(5,4),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legislative_matches_company_score
	ON legislative_company_matches (company_id, relevance_score);

CREATE INDEX IF NOT EXISTS idx_legislative_matches_document_type
	ON legislative_company_matches (legislative_document_id, match_type);

CREATE INDEX IF NOT EXISTS idx_legislative_matches_match_type
	ON legislative_company_matches (match_type);

CREATE TABLE IF NOT EXISTS daily_reports (
	id BIGSERIAL PRIMARY KEY,
	report_date DATE NOT NULL UNIQUE,
	market_session_date DATE NOT NULL,
	status TEXT NOT NULL,
	summary_json JSONB,
	markdown_path TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_status
	ON daily_reports (status);

CREATE TABLE IF NOT EXISTS audit_logs (
	id BIGSERIAL PRIMARY KEY,
	entity_type TEXT NOT NULL,
	entity_id BIGINT,
	action TEXT NOT NULL,
	source_document_id BIGINT REFERENCES source_documents(id),
	data_source_id BIGINT REFERENCES data_sources(id),
	confidence NUMERIC(5,4),
	details JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
	ON audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
	ON audit_logs (action, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_source_document
	ON audit_logs (source_document_id);
