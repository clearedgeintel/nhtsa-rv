-- 0001_schema.sql — RV defect intelligence base schema (CLAUDE.md §4)
-- Loads only the RV-filtered slice of NHTSA data. Keep lean.

create extension if not exists vector;

-- RV reference (built from vPIC + curated brand list)
create table if not exists rv_makes (
  make_canonical       text primary key,   -- e.g. 'WINNEBAGO'
  make_variants        text[],             -- raw spellings that map here
  category             text,               -- 'coach' | 'chassis' | 'towable'
  is_motorhome_chassis boolean             -- Ford/Freightliner/Mercedes etc.
);

create table if not exists recalls (
  campaign_id    text primary key,         -- NHTSA recall campaign number
  make_canonical text references rv_makes,
  model          text,
  model_year     int,
  component      text,
  recall_date    date,
  affected_units int,
  summary        text,
  consequence    text,
  remedy         text,
  is_chassis     boolean                    -- TRUE if filed on the motorhome chassis
);

create table if not exists complaints (
  odi_id         text primary key,          -- NHTSA ODI number
  make_canonical text references rv_makes,
  model          text,
  model_year     int,
  component      text,
  date_received  date,
  narrative      text,
  -- pre-computed narrative intelligence (ingestion §5):
  failure_mode   text,                      -- extracted/classified at ingest
  severity       text,                      -- classified at ingest
  embedding      vector(1024)               -- Voyage; dimension per chosen model
);

create table if not exists investigations (
  odi_action_no  text primary key,
  make_canonical text references rv_makes,
  component      text,
  open_date      date,
  close_date     date,
  subject        text,
  summary        text
);

create table if not exists tsbs (
  tsb_id         text primary key,
  make_canonical text references rv_makes,
  model          text,
  model_year     int,
  component      text,
  summary        text
);

-- Vector index for semantic narrative search (cosine).
create index if not exists complaints_embedding_hnsw
  on complaints using hnsw (embedding vector_cosine_ops);

-- Helpful B-tree indexes for the common structured filters.
create index if not exists recalls_make_year_idx     on recalls (make_canonical, model_year);
create index if not exists complaints_make_year_idx  on complaints (make_canonical, model_year);
