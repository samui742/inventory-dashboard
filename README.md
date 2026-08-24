# Inventory dashboard

This workspace uses one CSV database for the inventory dashboard:

- `Open_Dashboard.cmd` — double-click this to start and open the dashboard
- `Inventory_Dashboard.html` — self-contained dashboard file
- `consolidated/inventory.csv` — the only inventory database
- `scripts/` — repeatable PowerShell tools for inspecting and rebuilding the data
- `site/` — the searchable inventory dashboard

## Data rules

Records are stored in entry order. Existing records use IDs `1`, `2`, `3`, and each new record receives the next number. The database does not store source filename, worksheet, or source-row columns.

Status is controlled as `available`, `infrastructure`, or `checked-out`. A checked-out record must include the assigned user's name. Changing a checked-out record back to available or infrastructure automatically clears the assignment.
Infrastructure and checked-out equipment cannot use `Stockroom` as their location; another station or cabinet must be selected.

## Open the dashboard

Double-click `Open_Dashboard.cmd`. It starts the local dashboard and opens `http://127.0.0.1:4173/` in your browser.

## Change equipment types

Edit `config/equipment-types.json` to add, remove, or rename a type. Keep each type in quotes and separate entries with commas. Save the file and refresh the dashboard; the form and server validation use the same list automatically.

## Change equipment names

Edit `config/equipment-names.json` to add, remove, or rename a name in the form dropdown. Keep each name in quotes and separate entries with commas. Save the file and refresh the dashboard; the form and server validation use the same list automatically.

## Rebuild the dashboard

To refresh the self-contained dashboard from `consolidated/inventory.csv`, run:

```powershell
.\scripts\build-standalone-dashboard.ps1
```
