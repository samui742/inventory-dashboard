import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the D1-backed inventory workflow", async () => {
  const [page, layout, schema, migration] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0000_chilly_ikaris.sql", root), "utf8"),
  ]);

  assert.match(page, /Inventory lookup/);
  assert.match(page, /Search all inventory fields/);
  assert.match(page, /Export CSV/);
  assert.match(page, /Add new equipment/);
  assert.match(page, /Part number \/ PID/);
  assert.match(page, /checked-out/);
  assert.match(layout, /Inventory Lookup/);
  assert.match(schema, /sqliteTable\(\s*"equipment"/);
  assert.match(migration, /INSERT INTO equipment/);
  assert.equal((migration.match(/^\(\d+,'/gm) ?? []).length, 19);
});
