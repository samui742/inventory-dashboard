import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const equipment = sqliteTable(
  "equipment",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    status: text("status").notNull(),
    assignedTo: text("assigned_to").notNull().default(""),
    displayName: text("display_name").notNull(),
    recordDate: text("record_date").notNull(),
    category: text("category").notNull(),
    location: text("location").notNull(),
    partNumber: text("part_number").notNull().default(""),
    serialNumber: text("serial_number").notNull().default(""),
    quantity: integer("quantity").notNull().default(1),
    vendor: text("vendor").notNull().default(""),
    notes: text("notes").notNull().default(""),
  },
  (table) => [
    check("equipment_status_check", sql`${table.status} in ('available', 'infrastructure', 'checked-out')`),
    check("equipment_quantity_check", sql`${table.quantity} >= 1 and ${table.quantity} <= 10000`),
  ],
);
