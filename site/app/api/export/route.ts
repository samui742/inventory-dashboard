import { getD1 } from "@/db";
import { INVENTORY_SELECT, type DatabaseRecord, toInventoryRecord } from "@/lib/inventory";

export const runtime = "edge";

const HEADERS = [
  "id", "status", "assignedTo", "displayName", "recordDate", "category",
  "location", "partNumber", "serialNumber", "quantity", "vendor", "notes",
] as const;

function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[=+@]/.test(text) || /^-\D/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET() {
  const result = await getD1().prepare(`${INVENTORY_SELECT} ORDER BY id`).all<DatabaseRecord>();
  const records = result.results.map(toInventoryRecord);
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
