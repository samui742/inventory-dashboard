import { getSupabase } from "@/db";
import {
  type DatabaseRecord,
  INVENTORY_COLUMNS,
  toDatabaseValues,
  toInventoryRecord,
  validateEquipmentInput,
} from "@/lib/inventory";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function requestBody(request: Request) {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    throw new Error("Invalid request body");
  }
}

export async function POST(request: Request) {
  let input;
  try {
    input = validateEquipmentInput(await requestBody(request));
  } catch (error) {
    return Response.json({ error: errorMessage(error, "Equipment could not be saved") }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from("equipment")
    .insert(toDatabaseValues(input))
    .select(INVENTORY_COLUMNS)
    .single();

  if (error) {
    console.error("Equipment insert failed", error);
    return Response.json({ error: "Equipment could not be saved" }, { status: 500 });
  }

  return Response.json(
    { record: toInventoryRecord(data as unknown as DatabaseRecord) },
    { status: 201 },
  );
}

export async function PUT(request: Request) {
  let id: number;
  let input;
  try {
    const body = await requestBody(request);
    id = Number(body.id);
    if (!Number.isInteger(id) || id < 1) throw new Error("Equipment record was not found");
    input = validateEquipmentInput(body);
  } catch (error) {
    return Response.json({ error: errorMessage(error, "Equipment could not be saved") }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from("equipment")
    .update(toDatabaseValues(input))
    .eq("id", id)
    .select(INVENTORY_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("Equipment update failed", error);
    return Response.json({ error: "Equipment could not be saved" }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "Equipment record was not found" }, { status: 404 });
  }

  return Response.json({ record: toInventoryRecord(data as unknown as DatabaseRecord) });
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ error: "Equipment record was not found" }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from("equipment")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Equipment delete failed", error);
    return Response.json({ error: "Equipment could not be deleted" }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "Equipment record was not found" }, { status: 404 });
  }

  return Response.json({ id: String(data.id) });
}
