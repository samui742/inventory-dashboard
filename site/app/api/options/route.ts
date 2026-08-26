import { getSupabase } from "@/db";
import {
  getInventoryOptions,
  isInventoryOptionGroup,
  normalizeManagedOption,
} from "@/lib/managed-options";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Inventory options could not be saved";
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
    const body = await request.json() as { group?: unknown; value?: unknown };
    const group = String(body.group ?? "");
    if (!isInventoryOptionGroup(group)) throw new Error("Select a valid option group");
    const value = normalizeManagedOption(group, body.value);
    const current = await getInventoryOptions();
    if (current[group].some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      return Response.json({ error: "That option already exists" }, { status: 409 });
    }

    const { error } = await getSupabase()
      .from("inventory_options")
      .insert({ option_group: group, value });
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
