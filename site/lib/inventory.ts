export const EQUIPMENT_TYPES = [
  "Power supply",
  "Switch",
  "Cable",
  "FRU uplink",
  "PoE load",
  "SFP",
  "IXIA chassis",
  "IXIA card",
  "AC Source",
  "Other",
] as const;

export const EQUIPMENT_NAMES = [
  "Edgar5",
  "PWR-C1-1900WHV-T",
  "PWR-C2-850WAC-I",
  "XGS12",
  "XGS2",
  "XM12",
  "XMR4S",
  "PWR-C2-500WAC-I",
  "PWR-C2-1600WHV-I",
] as const;

export const LOCATIONS = ["Stockroom", "Station 1", "Station 2", "Station 3"] as const;
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
  partNumber: string;
  serialNumber: string;
  quantity: number;
  vendor: string;
  notes: string;
};

export type EquipmentInput = Omit<InventoryRecord, "id">;

export type DatabaseRecord = Omit<InventoryRecord, "id"> & { id: number };

export const INVENTORY_SELECT = `
  SELECT
    id,
    status,
    assigned_to AS assignedTo,
    display_name AS displayName,
    record_date AS recordDate,
    category,
    location,
    part_number AS partNumber,
    serial_number AS serialNumber,
    quantity,
    vendor,
    notes
  FROM equipment
`;

export function toInventoryRecord(record: DatabaseRecord): InventoryRecord {
  return { ...record, id: String(record.id) };
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
  const partNumber = String(input.partNumber ?? "").trim();
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
  if (partNumber.length > 160 || serialNumber.length > 160 || vendor.length > 120 || notes.length > 1000) {
    throw new Error("One or more fields are too long");
  }

  return {
    status,
    assignedTo: status === "checked-out" ? assignedTo : "",
    displayName,
    recordDate,
    category,
    location,
    partNumber,
    serialNumber,
    quantity,
    vendor,
    notes,
  };
}
