-- ============================================================================
-- GREENOT LAND MARKET RATE ANALYST — STARTER DATABASE SCHEMA
-- Migration: 001_greenot_schema.sql
-- Compatible with PostgreSQL 15+ / PostGIS / Supabase
-- Quality-Control Standard: Strict data segregation, auditable evidence trail,
-- immutable snapshots, and separate guideline vs asking vs transaction tiers.
-- ============================================================================

-- Ensure UUID and PostGIS extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ----------------------------------------------------------------------------
-- 1. ENUMS
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE greenot_property_category AS ENUM (
        'residential_land',
        'commercial_land',
        'agricultural_wet',
        'agricultural_dry',
        'industrial_land',
        'mixed_use'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE greenot_evidence_kind AS ENUM (
        'registered_transaction',
        'asking_listing',
        'guideline_benchmark',
        'broker_quote'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE greenot_verification_status AS ENUM (
        'unverified',
        'pending_review',
        'verified',
        'rejected',
        'quarantined'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE greenot_area_unit AS ENUM (
        'sqft',
        'cent',
        'ground',
        'acre',
        'sqm'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE greenot_confidence_label AS ENUM (
        'high',
        'medium',
        'low',
        'insufficient'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ----------------------------------------------------------------------------
-- 2. CORE PROPERTY & LOCATION TABLES
-- ----------------------------------------------------------------------------

-- Subject properties submitted for valuation
CREATE TABLE IF NOT EXISTS greenot_properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address TEXT NOT NULL,
    category greenot_property_category NOT NULL DEFAULT 'residential_land',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(Point, 4326),
    extent_value NUMERIC(14, 4),
    extent_unit greenot_area_unit DEFAULT 'cent',
    extent_sqft NUMERIC(14, 2),
    survey_number VARCHAR(100),
    subdivision VARCHAR(100),
    road_width_ft NUMERIC(8, 2),
    frontage_ft NUMERIC(8, 2),
    approval_status VARCHAR(100), -- CMDA, DTCP, Unapproved, etc.
    owner_attributes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Locations dictionary for normalized revenue geography
CREATE TABLE IF NOT EXISTS greenot_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    locality VARCHAR(200) NOT NULL,
    street VARCHAR(255),
    village VARCHAR(200),
    taluk VARCHAR(200),
    district VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL DEFAULT 'Tamil Nadu',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    geom GEOMETRY(Point, 4326),
    geocode_source VARCHAR(100),
    verification_status greenot_verification_status DEFAULT 'unverified',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Registry of lawful evidence sources (portals, government gazettes, broker agencies)
CREATE TABLE IF NOT EXISTS greenot_evidence_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    source_type VARCHAR(100) NOT NULL, -- government_registry, portal_listing, broker_quote, document_upload
    url_or_doc_id TEXT,
    terms_access_notes TEXT,
    reliability_class VARCHAR(50) NOT NULL, -- authoritative, verified_institution, portal_asking, unverified_manual
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. COMPARABLES & EVIDENCE OBSERVATIONS
-- ----------------------------------------------------------------------------

-- Comparable physical parcels
CREATE TABLE IF NOT EXISTS greenot_comparable_properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category greenot_property_category NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(Point, 4326),
    area_sqft NUMERIC(14, 2) NOT NULL,
    original_area NUMERIC(14, 4),
    original_unit greenot_area_unit DEFAULT 'sqft',
    dimensions_ft VARCHAR(100), -- e.g. '76x45'
    road_width_ft NUMERIC(8, 2),
    frontage_ft NUMERIC(8, 2),
    approval_status VARCHAR(100),
    locality VARCHAR(200),
    district VARCHAR(100),
    survey_number VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evidentiary records (registered deeds, listings, quotes)
CREATE TABLE IF NOT EXISTS greenot_property_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES greenot_properties(id) ON DELETE SET NULL,
    comparable_id UUID REFERENCES greenot_comparable_properties(id) ON DELETE SET NULL,
    source_id UUID REFERENCES greenot_evidence_sources(id) ON DELETE SET NULL,
    evidence_kind greenot_evidence_kind NOT NULL,
    evidence_date DATE NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_price_inr NUMERIC(16, 2) NOT NULL,
    land_area_sqft NUMERIC(14, 2) NOT NULL,
    original_price NUMERIC(16, 2),
    original_area NUMERIC(14, 4),
    original_unit greenot_area_unit DEFAULT 'sqft',
    rate_per_sqft NUMERIC(12, 2) NOT NULL,
    rate_per_cent NUMERIC(14, 2) NOT NULL,
    rate_per_ground NUMERIC(14, 2) NOT NULL,
    rate_per_acre NUMERIC(16, 2) NOT NULL,
    advertised_rate_per_sqft NUMERIC(12, 2),
    verification_status greenot_verification_status NOT NULL DEFAULT 'unverified',
    arithmetic_status VARCHAR(50) NOT NULL DEFAULT 'valid', -- 'valid', 'mismatch_flagged'
    arithmetic_discrepancy_pct NUMERIC(6, 2) DEFAULT 0.00,
    reviewer_notes TEXT,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. STATUTORY GUIDELINE VALUES & HISTORICAL SERIES
-- ----------------------------------------------------------------------------

-- Official statutory benchmarks (TNREGINET)
CREATE TABLE IF NOT EXISTS greenot_guideline_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district VARCHAR(100) NOT NULL,
    village VARCHAR(200) NOT NULL,
    street_or_survey VARCHAR(255) NOT NULL,
    zone VARCHAR(100),
    value_inr NUMERIC(14, 2) NOT NULL,
    unit greenot_area_unit NOT NULL DEFAULT 'sqft',
    rate_per_sqft NUMERIC(12, 2) NOT NULL,
    rate_per_cent NUMERIC(14, 2) NOT NULL,
    rate_per_ground NUMERIC(14, 2) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    official_reference TEXT,
    status greenot_verification_status NOT NULL DEFAULT 'verified',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historical rates (2010–2026) separating observed vs modelled series
CREATE TABLE IF NOT EXISTS greenot_historical_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    locality VARCHAR(200) NOT NULL,
    district VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    category greenot_property_category NOT NULL DEFAULT 'residential_land',
    series_type VARCHAR(50) NOT NULL, -- 'observed_transaction', 'observed_listing', 'statutory_guideline', 'modelled_market'
    rate_per_sqft NUMERIC(12, 2) NOT NULL,
    rate_per_cent NUMERIC(14, 2) NOT NULL,
    rate_per_ground NUMERIC(14, 2) NOT NULL,
    rate_per_acre NUMERIC(16, 2) NOT NULL,
    evidence_count INTEGER NOT NULL DEFAULT 0,
    confidence_score NUMERIC(5, 2),
    method_version VARCHAR(50) NOT NULL DEFAULT '1.0',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_greenot_history UNIQUE (locality, district, year, category, series_type)
);

-- ----------------------------------------------------------------------------
-- 5. VALUATION RUNS, ADJUSTMENTS & BUILDING APPRAISALS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS greenot_valuation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES greenot_properties(id) ON DELETE CASCADE,
    run_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    method_version VARCHAR(50) NOT NULL DEFAULT '1.0',
    inputs_snapshot JSONB NOT NULL,
    search_radius_meters INTEGER NOT NULL DEFAULT 1000,
    eligible_comparable_count INTEGER NOT NULL DEFAULT 0,
    rate_sqft_low NUMERIC(12, 2),
    rate_sqft_median NUMERIC(12, 2),
    rate_sqft_high NUMERIC(12, 2),
    rate_ground_median NUMERIC(14, 2),
    rate_cent_median NUMERIC(14, 2),
    rate_acre_median NUMERIC(16, 2),
    confidence_score NUMERIC(5, 2),
    confidence_label greenot_confidence_label NOT NULL DEFAULT 'insufficient',
    basis VARCHAR(100) NOT NULL, -- 'registered_transactions', 'asking_listings_only', 'insufficient_evidence'
    status VARCHAR(50) NOT NULL DEFAULT 'ok',
    hard_gate_reasons TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS greenot_valuation_run_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    valuation_run_id UUID NOT NULL REFERENCES greenot_valuation_runs(id) ON DELETE CASCADE,
    evidence_id UUID NOT NULL REFERENCES greenot_property_evidence(id) ON DELETE CASCADE,
    is_included BOOLEAN NOT NULL DEFAULT TRUE,
    exclusion_reason TEXT,
    distance_meters NUMERIC(10, 2),
    weight NUMERIC(6, 4) DEFAULT 1.0000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS greenot_valuation_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    valuation_run_id UUID NOT NULL REFERENCES greenot_valuation_runs(id) ON DELETE CASCADE,
    comparable_id UUID REFERENCES greenot_comparable_properties(id) ON DELETE SET NULL,
    factor_name VARCHAR(100) NOT NULL, -- 'distance', 'road_width', 'frontage', 'approval', 'time'
    raw_input_value TEXT,
    adjustment_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    adjustment_amount_inr NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    reason TEXT NOT NULL,
    rule_id VARCHAR(100),
    reviewer VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS greenot_building_valuations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    valuation_run_id UUID NOT NULL REFERENCES greenot_valuation_runs(id) ON DELETE CASCADE,
    built_up_area_sqft NUMERIC(10, 2) NOT NULL,
    construction_type VARCHAR(100) NOT NULL, -- 'RCC_Framed', 'Load_Bearing', 'Steel_Frame'
    age_years INTEGER NOT NULL DEFAULT 0,
    condition VARCHAR(50) NOT NULL DEFAULT 'average', -- 'good', 'average', 'poor'
    replacement_cost_per_sqft NUMERIC(10, 2) NOT NULL,
    gross_replacement_cost NUMERIC(14, 2) NOT NULL,
    depreciation_method VARCHAR(50) NOT NULL DEFAULT 'straight_line',
    depreciation_pct NUMERIC(5, 2) NOT NULL,
    depreciated_building_value NUMERIC(14, 2) NOT NULL,
    repair_or_demolition_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    is_demolition_intended BOOLEAN NOT NULL DEFAULT FALSE,
    net_building_value NUMERIC(14, 2) NOT NULL,
    total_property_value NUMERIC(16, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. SPATIAL & PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_greenot_prop_geom ON greenot_properties USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_greenot_comp_geom ON greenot_comparable_properties USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_greenot_loc_geom ON greenot_locations USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_greenot_ev_kind ON greenot_property_evidence (evidence_kind);
CREATE INDEX IF NOT EXISTS idx_greenot_ev_verif ON greenot_property_evidence (verification_status);
CREATE INDEX IF NOT EXISTS idx_greenot_ev_date ON greenot_property_evidence (evidence_date);
CREATE INDEX IF NOT EXISTS idx_greenot_gl_vill ON greenot_guideline_values (district, village);
CREATE INDEX IF NOT EXISTS idx_greenot_hist_loc ON greenot_historical_rates (district, locality, year);

-- ----------------------------------------------------------------------------
-- 7. BASIC ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE greenot_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE greenot_property_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE greenot_valuation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE greenot_building_valuations ENABLE ROW LEVEL SECURITY;

-- Allow read access to verified evidence and guideline benchmarks
DO $$ BEGIN
    CREATE POLICY "Public read for verified evidence" ON greenot_property_evidence
        FOR SELECT USING (verification_status = 'verified');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read for guideline values" ON greenot_guideline_values
        FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
