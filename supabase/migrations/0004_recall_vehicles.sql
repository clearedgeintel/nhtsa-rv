-- 0004_recall_vehicles.sql — restore per-vehicle granularity for recalls.
--
-- recalls is campaign-level (PK campaign_id), so the source's one-row-per-(campaign,make,
-- model,year) detail collapses and recalls.model_year is representative-only. This child
-- table preserves the (campaign × make × model × year) grain so model-year-precise recall
-- questions are answerable, e.g. "how many recalls on Winnebago Class A in 2024" =
--   select count(distinct campaign_id) from v_recall_vehicles
--   where make_canonical='WINNEBAGO' and model_year=2024 and model ilike '%class a%';
-- A "recall" is still one campaign — always COUNT(DISTINCT campaign_id), never row count.

create table if not exists recall_vehicles (
  rv_id          text primary key,                 -- deterministic: campaign|make|model|year
  campaign_id    text not null references recalls(campaign_id) on delete cascade,
  make_canonical text references rv_makes,
  model          text,
  model_year     int,
  is_chassis     boolean
);

create index if not exists recall_vehicles_campaign_idx on recall_vehicles (campaign_id);
create index if not exists recall_vehicles_make_year_idx on recall_vehicles (make_canonical, model_year);

create or replace view v_recall_vehicles as
  select rv_id, campaign_id, make_canonical, model, model_year, is_chassis
  from recall_vehicles;

grant select on v_recall_vehicles to agent_readonly;
