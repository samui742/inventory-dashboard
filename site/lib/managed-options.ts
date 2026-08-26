import "server-only";

import { getSupabase } from "@/db";
import {
  DEFAULT_INVENTORY_OPTIONS,
  type InventoryOptionGroup,
  type InventoryOptions,
} from "@/lib/inventory";

export const INVENTORY_OPTION_GROUPS: readonly InventoryOptionGroup[] = [
  "equipmentTypes",
  "locations",
  "statuses",
  "equipmentNames",
];

type ManagedOptionRow = {
  id: number;
  option_group: InventoryOptionGroup;
  value: string;
};

export function isInventoryOptionGroup(value: string): value is InventoryOptionGroup {
  return (INVENTORY_OPTION_GROUPS as readonly string[]).includes(value);
}

export function normalizeManagedOption(group: InventoryOptionGroup, rawValue: unknown) {
  const text = String(rawValue ?? "").trim().replace(/\s+/g, " ");
  if (!text) throw new Error("Enter a value to add");
  if ([...text].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    throw new Error("The option contains invalid characters");
  }

  if (group === "statuses") {
    const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug) throw new Error("Enter a status using letters or numbers");
    if (slug.length > 60) throw new Error("Availability status must be 60 characters or fewer");
    return slug;
  }

  const maximum = group === "equipmentNames" ? 160 : 120;
  if (text.length > maximum) throw new Error("The option is too long");
  return text;
}

function mergedValues(defaults: string[], additions: string[]) {
  const values = new Map<string, string>();
  [...defaults, ...additions].forEach((value) => {
    const key = value.trim().toLowerCase();
    if (key && !values.has(key)) values.set(key, value.trim());
  });
  return [...values.values()];
}

export async function getInventoryOptions(): Promise<InventoryOptions> {
  const { data, error } = await getSupabase()
    .from("inventory_options")
    .select("id,option_group,value")
    .order("id");
  if (error) throw error;

  const rows = (data ?? []) as ManagedOptionRow[];
  return {
    equipmentTypes: mergedValues(
      DEFAULT_INVENTORY_OPTIONS.equipmentTypes,
      rows.filter((row) => row.option_group === "equipmentTypes").map((row) => row.value),
    ),
    locations: mergedValues(
      DEFAULT_INVENTORY_OPTIONS.locations,
      rows.filter((row) => row.option_group === "locations").map((row) => row.value),
    ),
    statuses: mergedValues(
      DEFAULT_INVENTORY_OPTIONS.statuses,
      rows.filter((row) => row.option_group === "statuses").map((row) => row.value),
    ),
    equipmentNames: mergedValues(
      DEFAULT_INVENTORY_OPTIONS.equipmentNames,
      rows.filter((row) => row.option_group === "equipmentNames").map((row) => row.value),
    ),
  };
}
