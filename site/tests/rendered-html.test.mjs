import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the Supabase-backed inventory workflow", async () => {
  const [page, layout, database, schema, seed] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("db/index.ts", root), "utf8"),
    readFile(new URL("supabase/schema.sql", root), "utf8"),
    readFile(new URL("supabase/seed.sql", root), "utf8"),
  ]);

  assert.match(page, /Inventory lookup/);
  assert.match(page, /Search all inventory fields/);
  assert.match(page, /Export CSV/);
  assert.match(page, /Add new equipment/);
  assert.match(page, /Part number \/ PID/);
  assert.match(page, /checked-out/);
  assert.match(layout, /Inventory Lookup/);
  assert.match(database, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(schema, /create table if not exists public\.equipment/);
  assert.match(schema, /enable row level security/);
  assert.equal((seed.match(/^\s*\(\d+,'/gm) ?? []).length, 19);
});
