import {
  CSV_HEADERS,
  type EquipmentInput,
  type InventoryRecord,
  validateEquipmentInput,
} from "@/lib/inventory";

export type ImportRowStatus = "ready" | "duplicate" | "invalid";

export type ImportRowResult = {
  row: number;
  displayName: string;
  serialNumber: string;
  status: ImportRowStatus;
  reason: string;
};

export type ImportAnalysis = {
  totalRows: number;
  readyCount: number;
  duplicateCount: number;
  invalidCount: number;
  rows: ImportRowResult[];
  readyInputs: EquipmentInput[];
};

const MAX_IMPORT_ROWS = 1000;

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("The CSV contains an unclosed quoted value");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function normalized(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function meaningfulSerial(value: string) {
  const serial = normalized(value);
  return serial && !["n/a", "na", "none"].includes(serial) ? serial : "";
}

function duplicateKey(input: EquipmentInput) {
  const serial = meaningfulSerial(input.serialNumber);
  if (serial) return "serial:" + serial;
  return "record:" + JSON.stringify([
    input.status,
    input.assignedTo,
    input.displayName,
    input.recordDate,
    input.category,
    input.location,
    input.pid,
    input.mfgPartNumber,
    input.quantity,
    input.vendor,
    input.notes,
  ].map((value) => normalized(String(value))));
}

function recordInput(record: InventoryRecord): EquipmentInput {
  const { id: _id, ...input } = record;
  void _id;
  return input;
}

function importCell(value: string) {
  return /^'[=+@]/.test(value) || /^'-\D/.test(value) ? value.slice(1) : value;
}

export function analyzeCsvImport(csvText: string, existing: InventoryRecord[]): ImportAnalysis {
  if (!csvText.trim()) throw new Error("Choose a CSV file containing equipment records");
  if (csvText.length > 2_000_000) throw new Error("The CSV file must be smaller than 2 MB");

  const parsed = parseCsvRows(csvText.replace(/^\uFEFF/, ""));
  if (!parsed.length) throw new Error("The CSV file is empty");
  const headers = parsed[0].map((value) => value.trim());
  if (headers.length !== CSV_HEADERS.length || headers.some((value, index) => value !== CSV_HEADERS[index])) {
    throw new Error("Use these CSV columns in this order: " + CSV_HEADERS.join(", "));
  }

  const dataRows = parsed.slice(1);
  if (!dataRows.length) throw new Error("The CSV does not contain any equipment rows");
  if (dataRows.length > MAX_IMPORT_ROWS) throw new Error("Import no more than " + MAX_IMPORT_ROWS + " rows at a time");

  const seen = new Map<string, string>();
  existing.forEach((record) => {
    const key = duplicateKey(recordInput(record));
    if (!seen.has(key)) seen.set(key, "existing record ID " + record.id);
  });

  const rows: ImportRowResult[] = [];
  const readyInputs: EquipmentInput[] = [];
  dataRows.forEach((values, index) => {
    const rowNumber = index + 2;
    const displayName = importCell(values[3] ?? "").trim();
    const serialNumber = importCell(values[9] ?? "").trim();
    try {
      if (values.length !== CSV_HEADERS.length) {
        throw new Error("Expected " + CSV_HEADERS.length + " columns but found " + values.length);
      }
      const input = validateEquipmentInput({
        status: importCell(values[1]),
        assignedTo: importCell(values[2]),
        displayName,
        recordDate: importCell(values[4]),
        category: importCell(values[5]),
        location: importCell(values[6]),
        pid: importCell(values[7]),
        mfgPartNumber: importCell(values[8]),
        serialNumber,
        quantity: importCell(values[10]),
        vendor: importCell(values[11]),
        notes: importCell(values[12]),
      });
      const key = duplicateKey(input);
      const duplicate = seen.get(key);
      if (duplicate) {
        rows.push({ row: rowNumber, displayName, serialNumber, status: "duplicate", reason: "Matches " + duplicate });
        return;
      }
      seen.set(key, "uploaded row " + rowNumber);
      readyInputs.push(input);
      rows.push({ row: rowNumber, displayName, serialNumber, status: "ready", reason: "Ready to import" });
    } catch (error) {
      rows.push({
        row: rowNumber,
        displayName,
        serialNumber,
        status: "invalid",
        reason: error instanceof Error ? error.message : "Invalid equipment row",
      });
    }
  });

  return {
    totalRows: dataRows.length,
    readyCount: readyInputs.length,
    duplicateCount: rows.filter((row) => row.status === "duplicate").length,
    invalidCount: rows.filter((row) => row.status === "invalid").length,
    rows,
    readyInputs,
  };
}
