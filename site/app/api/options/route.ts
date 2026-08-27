import { getSupabase } from "@/db";
import {
  getInventoryOptions,
  isInventoryOptionGroup,
  managedOptionKey,
  normalizeManagedOption,
} from "@/lib/managed-options";
import type { InventoryOptionGroup } from "@/lib/inventory";

const EQUIPMENT_OPTION_COLUMNS: Record<InventoryOptionGroup, string> = {
  equipmentTypes: "category",
  locations: "location",
  statuses: "status",
  equipmentNames: "display_name",
};

function message(error: unknown) {
  return error instanceof Error ? error.message : "Inventory options could not be saved";
}

async function optionRequest(request: Request) {
  const body = await request.json() as { group?: unknown; value?: unknown };
  const group = String(body.group ?? "");
  if (!isInventoryOptionGroup(group)) throw new Error("Select a valid option group");
  return { group, value: normalizeManagedOption(group, body.value) };
}

async function optionRow(group: InventoryOptionGroup, value: string) {
  const { data, error } = await getSupabase()
    .from("inventory_options")
    .select("id,is_removed")
    .eq("option_group", group)
    .eq("value_key", managedOptionKey(value))
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET() {
  try {
    return Response.json(await getInventoryOptions(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Inventory options query failed", error);
    return Response.json({ error: "Inventory options could not be loaded" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { group, value } = await optionRequest(request);
    const current = await getInventoryOptions();
    if (current[group].some((existing) => managedOptionKey(existing) === managedOptionKey(value))) {
      return Response.json({ error: "That option already exists" }, { status: 409 });
    }

    const existing = await optionRow(group, value);
    const query = existing
      ? getSupabase().from("inventory_options").update({ value, is_removed: false }).eq("id", existing.id)
      : getSupabase().from("inventory_options").insert({ option_group: group, value });
    const { error } = await query;
    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "That option already exists" }, { status: 409 });
      }
      throw error;
    }

    return Response.json({ options: await getInventoryOptions(), value }, { status: 201 });
  } catch (error) {
    console.error("Inventory option insert failed", error);
    return Response.json({ error: message(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { group, value } = await optionRequest(request);
    const current = await getInventoryOptions();
    const currentValue = current[group].find(
      (existing) => managedOptionKey(existing) === managedOptionKey(value),
    );
    if (!currentValue) {
      return Response.json({ error: "That option was not found" }, { status: 404 });
    }
    if (current[group].length <= 1) {
      return Response.json({ error: "The last option in a required list cannot be removed" }, { status: 409 });
    }

    const column = EQUIPMENT_OPTION_COLUMNS[group];
    const { data, error: usageError } = await getSupabase()
      .from("equipment")
      .select(`id,${column}`);
    if (usageError) throw usageError;
    const usageCount = ((data ?? []) as unknown as Array<Record<string, unknown>>)
      .filter((record) => managedOptionKey(String(record[column] ?? "")) === managedOptionKey(currentValue))
      .length;
    if (usageCount) {
      return Response.json({
        error: `This option is used by ${usageCount} equipment record${usageCount === 1 ? "" : "s"}. Update those records first.`,
      }, { status: 409 });
    }

    const existing = await optionRow(group, currentValue);
    const query = existing
      ? getSupabase().from("inventory_options").update({ is_removed: true }).eq("id", existing.id)
      : getSupabase().from("inventory_options").insert({
          option_group: group,
          value: currentValue,
          is_removed: true,
        });
    const { error } = await query;
    if (error) throw error;

    return Response.json({ options: await getInventoryOptions(), value: currentValue });
  } catch (error) {
    console.error("Inventory option removal failed", error);
    return Response.json({ error: message(error) }, { status: 400 });
  }
}
