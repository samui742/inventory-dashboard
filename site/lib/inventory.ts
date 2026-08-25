import equipmentNames from "../../config/equipment-names.json";
import equipmentTypes from "../../config/equipment-types.json";
import locations from "../../config/locations.json";

export const EQUIPMENT_TYPES: readonly string[] = equipmentTypes;
export const EQUIPMENT_NAMES: readonly string[] = equipmentNames;
export const LOCATIONS: readonly string[] = locations;
export const STATUSES = ["available", "infrastructure", "checked-out"] as const;

export type InventoryStatus = (typeof STATUSES)[number];

export type InventoryRecord = {
  id: string;
  status: InventoryStatus;
  assignedTo: string;
  displayName: string;
  recordDate: string;
  category: string;
  location: string;
  pid: string;
  mfgPartNumber: string;
  serialNumber: string;
  quantity: number;
  vendor: string;
  notes: string;
};

export type EquipmentInput = Omit<InventoryRecord, "id">;

export const CSV_HEADERS = [
  "id", "status", "assignedTo", "displayName", "recordDate", "category",
  "location", "pid", "mfgPartNumber", "serialNumber", "quantity", "vendor", "notes",
] as const;

export type DatabaseRecord = {
  id: number;
  status: InventoryStatus;
  assigned_to: string;
  display_name: string;
  record_date: string;
  category: string;
  location: string;
  pid: string;
  mfg_part_number: string;
  serial_number: string;
  quantity: number;
  vendor: string;
  notes: string;
};

export const INVENTORY_COLUMNS = [
  "id", "status", "assigned_to", "display_name", "record_date", "category",
  "location", "pid", "mfg_part_number", "serial_number", "quantity", "vendor", "notes",
].join(",");

export function toInventoryRecord(record: DatabaseRecord): InventoryRecord {
  return {
    id: String(record.id),
    status: record.status,
    assignedTo: record.assigned_to,
    displayName: record.display_name,
    recordDate: record.record_date,
    category: record.category,
    location: record.location,
    pid: record.pid,
    mfgPartNumber: record.mfg_part_number,
    serialNumber: record.serial_number,
    quantity: record.quantity,
    vendor: record.vendor,
    notes: record.notes,
  };
}

export function toDatabaseValues(input: EquipmentInput): Omit<DatabaseRecord, "id"> {
  return {
    status: input.status,
    assigned_to: input.assignedTo,
    display_name: input.displayName,
    record_date: input.recordDate,
    category: input.category,
    location: input.location,
    pid: input.pid,
    mfg_part_number: input.mfgPartNumber,
    serial_number: input.serialNumber,
    quantity: input.quantity,
    vendor: input.vendor,
    notes: input.notes,
  };
}

export function validateEquipmentInput(value: unknown): EquipmentInput {
  if (!value || typeof value !== "object") throw new Error("Invalid request body");
  const input = value as Record<string, unknown>;
  const status = String(input.status ?? "").trim().toLowerCase() as InventoryStatus;
  const assignedTo = String(input.assignedTo ?? "").trim();
  const displayName = String(input.displayName ?? "").trim();
  const recordDate = String(input.recordDate ?? "").trim();
  const category = String(input.category ?? "").trim();
  const location = String(input.location ?? "").trim();
  const pid = String(input.pid ?? "").trim() || "n/a";
  const mfgPartNumber = String(input.mfgPartNumber ?? "").trim();
  const serialNumber = String(input.serialNumber ?? "").trim();
  const quantity = Number(input.quantity);
  const vendor = String(input.vendor ?? "").trim();
  const notes = String(input.notes ?? "").trim();

  if (!(STATUSES as readonly string[]).includes(status)) throw new Error("Select a valid availability status");
  if (!(EQUIPMENT_TYPES as readonly string[]).includes(category)) throw new Error("Select a valid equipment type");
  if (!(EQUIPMENT_NAMES as readonly string[]).includes(displayName)) throw new Error("Select a valid equipment name");
  if (!(LOCATIONS as readonly string[]).includes(location)) throw new Error("Select a valid location");
  if (status === "checked-out" && !assignedTo) throw new Error("Enter the user assigned to this equipment");
  if ((status === "infrastructure" || status === "checked-out") && location.toLowerCase() === "stockroom") {
    throw new Error("Infrastructure and checked-out equipment cannot remain in Stockroom");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate) || Number.isNaN(Date.parse(`${recordDate}T00:00:00Z`))) {
    throw new Error("Enter a valid record date");
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
    throw new Error("Quantity must be between 1 and 10,000");
  }
  if (pid.length > 160 || mfgPartNumber.length > 160 || serialNumber.length > 160 || vendor.length > 120 || notes.length > 1000) {
    throw new Error("One or more fields are too long");
  }

  return {
    status,
    assignedTo: status === "checked-out" ? assignedTo : "",
    displayName,
    recordDate,
    category,
    location,
    pid,
    mfgPartNumber,
    serialNumber,
    quantity,
    vendor,
    notes,
  };
}
