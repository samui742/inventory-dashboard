import { getSupabase } from "@/db";
import {
  INVENTORY_COLUMNS,
  LEGACY_INVENTORY_COLUMNS,
  isMissingOptionalEquipmentColumns,
  type DatabaseRecord,
  toInventoryRecord,
} from "@/lib/inventory";

export async function GET() {
  try {
    const supabase = getSupabase();
    let { data, error } = await supabase
      .from("equipment")
      .select(INVENTORY_COLUMNS)
      .order("id");
    if (isMissingOptionalEquipmentColumns(error)) {
      ({ data, error } = await supabase
        .from("equipment")
        .select(LEGACY_INVENTORY_COLUMNS)
        .order("id"));
    }
    if (error) throw error;
    return Response.json((data as unknown as DatabaseRecord[]).map(toInventoryRecord), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Inventory query failed", error);
    return Response.json({ error: "Inventory could not be loaded" }, { status: 500 });
  }
}
