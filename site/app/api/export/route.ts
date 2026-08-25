import { getSupabase } from "@/db";
import { INVENTORY_COLUMNS, type DatabaseRecord, toInventoryRecord } from "@/lib/inventory";

const HEADERS = [
  "id", "status", "assignedTo", "displayName", "recordDate", "category",
  "location", "pid", "mfgPartNumber", "serialNumber", "quantity", "vendor", "notes",
] as const;

function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[=+@]/.test(text) || /^-\D/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET() {
  const { data, error } = await getSupabase()
    .from("equipment")
    .select(INVENTORY_COLUMNS)
    .order("id");
  if (error) {
    console.error("Inventory export failed", error);
    return Response.json({ error: "Inventory could not be exported" }, { status: 500 });
  }
  const records = (data as unknown as DatabaseRecord[]).map(toInventoryRecord);
  const csv = [
    HEADERS.map(csvCell).join(","),
    ...records.map((record) => HEADERS.map((header) => csvCell(record[header])).join(",")),
  ].join("\r\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=inventory.csv",
      "Cache-Control": "no-store",
    },
  });
}
