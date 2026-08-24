import { getD1 } from "@/db";
import { INVENTORY_SELECT, type DatabaseRecord, toInventoryRecord } from "@/lib/inventory";

export const runtime = "edge";

export async function GET() {
  try {
    const result = await getD1().prepare(`${INVENTORY_SELECT} ORDER BY id`).all<DatabaseRecord>();
    return Response.json(result.results.map(toInventoryRecord), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Inventory query failed", error);
    return Response.json({ error: "Inventory could not be loaded" }, { status: 500 });
  }
}
