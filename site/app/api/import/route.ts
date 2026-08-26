import { getSupabase } from "@/db";
import { analyzeCsvImport } from "@/lib/csv-import";
import { getInventoryOptions } from "@/lib/managed-options";
import {
  INVENTORY_COLUMNS,
  type DatabaseRecord,
  toDatabaseValues,
  toInventoryRecord,
} from "@/lib/inventory";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The CSV could not be processed";
}

async function requestBody(request: Request) {
  try {
    return await request.json() as { action?: unknown; csvText?: unknown };
  } catch {
    throw new Error("Invalid request body");
  }
}

async function inventoryRecords() {
  const { data, error } = await getSupabase()
    .from("equipment")
    .select(INVENTORY_COLUMNS)
    .order("id");
  if (error) throw error;
  return (data as unknown as DatabaseRecord[]).map(toInventoryRecord);
}

export async function POST(request: Request) {
  try {
    const body = await requestBody(request);
    const action = String(body.action ?? "preview");
    const csvText = String(body.csvText ?? "");
    if (!["preview", "import"].includes(action)) throw new Error("Invalid import action");

    const analysis = analyzeCsvImport(csvText, await inventoryRecords(), await getInventoryOptions());
    const preview = {
      totalRows: analysis.totalRows,
      readyCount: analysis.readyCount,
      duplicateCount: analysis.duplicateCount,
      invalidCount: analysis.invalidCount,
      rows: analysis.rows,
    };
    if (action === "preview" || analysis.readyInputs.length === 0) {
      return Response.json({ preview, records: [] });
    }

    const { data, error } = await getSupabase()
      .from("equipment")
      .insert(analysis.readyInputs.map(toDatabaseValues))
      .select(INVENTORY_COLUMNS);
    if (error) throw error;
    const records = (data as unknown as DatabaseRecord[]).map(toInventoryRecord);
    return Response.json({ preview, records }, { status: 201 });
  } catch (error) {
    console.error("CSV import failed", error);
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}
