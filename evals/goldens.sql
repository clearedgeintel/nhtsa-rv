-- Golden queries behind evals/fixtures.ts. Re-run after any data refresh and update the
-- `number` values + the "Verified" date in fixtures.ts. Run via the Supabase SQL editor,
-- psql, or the MCP. Values shown are as of 2026-06-19.

select 'winn-coach-recalls'   as fixture, count(distinct campaign_id) as expected from recall_vehicles where make_canonical='WINNEBAGO' and is_chassis=false;          -- 159
select 'winn-2024-recalls'    as fixture, count(distinct campaign_id) as expected from recall_vehicles where make_canonical='WINNEBAGO' and model_year=2024 and is_chassis=false; -- 25
select 'forest-recalls'       as fixture, count(distinct campaign_id) as expected from recall_vehicles where make_canonical='FOREST RIVER'; -- 537 (all campaigns involving Forest River)
select 'grand-design-recalls' as fixture, count(*) as expected from recalls where make_canonical='GRAND DESIGN';       -- 56
select 'total-recalls'        as fixture, count(*) as expected from recalls;                                            -- 2650
select 'brinkley-recalls'     as fixture, count(*) as expected from recalls where make_canonical='BRINKLEY';            -- 11
select 'forest-fire'          as fixture, count(*) as expected from complaints where make_canonical='FOREST RIVER' and failure_mode='fire'; -- 100
select 'winn-complaints'      as fixture, count(*) as expected from complaints where make_canonical='WINNEBAGO';        -- 1460
select 'winn-critical'        as fixture, count(*) as expected from complaints where make_canonical='WINNEBAGO' and severity='critical';    -- 578
select 'brinkley-complaints'  as fixture, count(*) as expected from complaints where make_canonical='BRINKLEY';         -- 6
select 'affected-units'       as fixture, sum(affected_units) as expected from recalls where make_canonical='WINNEBAGO'; -- 302658
select 'winn-investigations'  as fixture, count(*) as expected from investigations where make_canonical='WINNEBAGO';    -- 20
