import { getD1 } from "@/db";
import {
  type DatabaseRecord,
  type EquipmentInput,
  INVENTORY_SELECT,
  toInventoryRecord,
  validateEquipmentInput,
} from "@/lib/inventory";

export const runtime = "edge";

async function readRecord(id: number) {
  const record = await getD1()
    .prepare(`${INVENTORY_SELECT} WHERE id = ?`)
    .bind(id)
    .first<DatabaseRecord>();
  return record ? toInventoryRecord(record) : null;
}

function inputValues(input: EquipmentInput) {
  return [
    input.status,
    input.assignedTo,
    input.displayName,
    input.recordDate,
    input.category,
    input.location,
    input.partNumber,
    input.serialNumber,
    input.quantity,
    input.vendor,
    input.notes,
  ] as const;
}

export async function POST(request: Request) {
  try {
    const input = validateEquipmentInput(await request.json());
    const result = await getD1().prepare(`
        INSERT INTO equipment (
          status, assigned_to, display_name, record_date, category, location,
          part_number, serial_number, quantity, vendor, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(...inputValues(input)).run();
    const record = await readRecord(Number(result.meta.last_row_id));
    return Response.json({ record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Equipment could not be saved";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    if (!Number.isInteger(id) || id < 1) throw new Error("Equipment record was not found");
    if (!(await readRecord(id))) throw new Error("Equipment record was not found");
    const input = validateEquipmentInput(body);
    await getD1().prepare(`
        UPDATE equipment SET
          status = ?, assigned_to = ?, display_name = ?, record_date = ?, category = ?,
          location = ?, part_number = ?, serial_number = ?, quantity = ?, vendor = ?, notes = ?
        WHERE id = ?
      `).bind(...inputValues(input), id).run();
    const record = await readRecord(id);
    return Response.json({ record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Equipment could not be saved";
    return Response.json({ error: message }, { status: 400 });
  }
}
