// Offline test for the SQL guard. Run: npx tsx agent/_sql_guard.test.ts
import { guardSql } from "./sql_guard.ts";

let pass = 0, fail = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log("  ok: " + msg); }
  else { fail++; console.error("  FAIL: " + msg); }
}

// --- allowed ---
const a1 = guardSql("select count(*) from v_recalls");
ok(a1.ok && /limit 1000/.test(a1.sql), "plain SELECT gets a LIMIT appended");

const a2 = guardSql("SELECT * FROM v_complaints WHERE make_canonical = 'WINNEBAGO' LIMIT 5");
ok(a2.ok && /limit 5/i.test(a2.sql) && !/limit 1000/.test(a2.sql), "existing LIMIT preserved");

const a3 = guardSql("with c as (select make_canonical from v_recalls) select count(*) from c");
ok(a3.ok, "WITH … SELECT allowed");

const a4 = guardSql("select * from v_complaints where narrative ilike '%delete the brakes; drop%'");
ok(a4.ok, "DDL words INSIDE a string literal are not flagged");

const a5 = guardSql("select count(*) from v_recalls;");
ok(a5.ok && !/;/.test(a5.sql), "single trailing semicolon stripped");

// --- rejected ---
ok(!guardSql("update v_recalls set model='x'").ok, "UPDATE rejected");
ok(!guardSql("select 1; drop table recalls").ok, "second statement rejected");
ok(!guardSql("select * from recalls -- sneaky").ok, "line comment rejected");
ok(!guardSql("select * from pg_user").ok, "pg_* rejected");
ok(!guardSql("select * from information_schema.tables").ok, "information_schema rejected");
ok(!guardSql("delete from v_complaints").ok, "DELETE rejected");
ok(!guardSql("insert into recalls values (1)").ok, "INSERT rejected");
ok(!guardSql("").ok, "empty rejected");
ok(!guardSql("select 1 /* block */").ok, "block comment rejected");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
