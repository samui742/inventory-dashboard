import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the Supabase-backed inventory workflow", async () => {
  const [page, layout, database, inventory, schema, seed] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("db/index.ts", root), "utf8"),
    readFile(new URL("lib/inventory.ts", root), "utf8"),
    readFile(new URL("supabase/schema.sql", root), "utf8"),
    readFile(new URL("supabase/seed.sql", root), "utf8"),
  ]);

  assert.match(page, /Inventory lookup/);
  assert.match(page, /Search all inventory fields/);
  assert.match(page, /filteredAvailable\.reduce/);
  assert.match(page, /filteredCheckedOut\.reduce/);
  assert.match(page, /Export CSV/);
  assert.match(page, /Add new equipment/);
  assert.match(page, /Delete item/);
  assert.match(page, /window\.confirm/);
  assert.match(page, /PID \(optional\)/);
  assert.match(page, /MFG Part number \(optional\)/);
  assert.match(page, /checked-out/);
  assert.match(layout, /Inventory Lookup/);
  assert.match(database, /SUPABASE_SERVICE_ROLE_KEY/);
  const equipmentRoute = await readFile(new URL("app/api/equipment/route.ts", root), "utf8");
  assert.match(equipmentRoute, /export async function DELETE/);
  assert.match(equipmentRoute, /duplicateSerialRecord/);
  assert.match(equipmentRoute, /status: 409/);
  const importRoute = await readFile(new URL("app/api/import/route.ts", root), "utf8");
  const optionsRoute = await readFile(new URL("app/api/options/route.ts", root), "utf8");
  const managedOptions = await readFile(new URL("lib/managed-options.ts", root), "utf8");
  const csvImport = await readFile(new URL("lib/csv-import.ts", root), "utf8");
  assert.match(page, /Import equipment CSV/);
  assert.match(page, /Manage form options/);
  assert.match(page, /Manage options/);
  assert.match(page, /Select CSV to import/);
  assert.match(page, /Select a CSV first/);
  assert.match(page, /Duplicate and invalid rows were skipped/);
  assert.match(importRoute, /analyzeCsvImport/);
  assert.match(importRoute, /action === "preview"/);
  assert.match(importRoute, /getInventoryOptions/);
  assert.match(optionsRoute, /export async function POST/);
  assert.match(optionsRoute, /export async function DELETE/);
  assert.match(optionsRoute, /Update those records first/);
  assert.match(optionsRoute, /That option already exists/);
  assert.match(managedOptions, /inventory_options/);
  assert.match(managedOptions, /is_removed/);
  assert.match(csvImport, /serial:/);
  assert.match(csvImport, /existing record ID/);
  assert.match(csvImport, /uploaded row/);
  assert.match(inventory, /\.\.\/\.\.\/config\/equipment-names\.json/);
  assert.match(inventory, /\.\.\/\.\.\/config\/equipment-types\.json/);
  assert.match(inventory, /\.\.\/\.\.\/config\/locations\.json/);
  assert.match(schema, /create table if not exists public\.equipment/);
  assert.match(schema, /create table if not exists public\.inventory_options/);
  assert.match(schema, /is_removed boolean not null default false/);
  assert.match(schema, /prevent_duplicate_equipment_serial/);
  assert.match(schema, /pid text not null default 'n\/a'/);
  assert.match(schema, /mfg_part_number text not null default/);
  assert.match(schema, /enable row level security/);
  assert.equal((seed.match(/^\s*\(\d+,'/gm) ?? []).length, 19);
});
