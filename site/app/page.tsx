"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { ImportRowResult } from "@/lib/csv-import";
import {
  DEFAULT_INVENTORY_OPTIONS,
  type EquipmentInput,
  type InventoryOptionGroup,
  type InventoryOptions,
  type InventoryRecord,
  type InventoryStatus,
} from "@/lib/inventory";

const PAGE_SIZE = 24;

type CsvImportPreview = {
  totalRows: number;
  readyCount: number;
  duplicateCount: number;
  invalidCount: number;
  rows: ImportRowResult[];
};

const OPTION_GROUPS: Array<{
  group: InventoryOptionGroup;
  label: string;
  placeholder: string;
  helper: string;
}> = [
  { group: "equipmentTypes", label: "Equipment type", placeholder: "Example: Chamber", helper: "Used to categorize equipment." },
  { group: "locations", label: "Location", placeholder: "Example: Cabinet A3", helper: "Station or cabinet name." },
  { group: "statuses", label: "Availability status", placeholder: "Example: Under repair", helper: "Spaces are converted to hyphens." },
  { group: "equipmentNames", label: "Equipment name", placeholder: "Example: Edgar6", helper: "Controlled equipment model or name." },
];

function emptyOptionDrafts(): Record<InventoryOptionGroup, string> {
  return { equipmentTypes: "", locations: "", statuses: "", equipmentNames: "" };
}

function todayString() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateInputValue(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return todayString();
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function newEquipment(): EquipmentInput {
  return {
    status: "available",
    assignedTo: "",
    displayName: "",
    recordDate: todayString(),
    category: "",
    location: DEFAULT_INVENTORY_OPTIONS.locations.find((value) => value.toLowerCase() === "stockroom") ?? "",
    pid: "n/a",
    mfgPartNumber: "",
    serialNumber: "",
    quantity: 1,
    vendor: "",
    notes: "",
  };
}

function statusLabel(value: InventoryStatus) {
  if (value === "checked-out") return "Checked out";
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function categoryName(record: InventoryRecord) {
  return record.category || "Uncategorized";
}

export default function Home() {
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InventoryStatus | "all">("all");
  const [category, setCategory] = useState("All categories");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<InventoryRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<EquipmentInput>(newEquipment);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importCsvText, setImportCsvText] = useState("");
  const [importPreview, setImportPreview] = useState<CsvImportPreview | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");
  const [importNotice, setImportNotice] = useState("");
  const [inventoryOptions, setInventoryOptions] = useState<InventoryOptions>(DEFAULT_INVENTORY_OPTIONS);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [optionDrafts, setOptionDrafts] = useState<Record<InventoryOptionGroup, string>>(emptyOptionDrafts);
  const [optionSaving, setOptionSaving] = useState<InventoryOptionGroup | "">("");
  const [optionError, setOptionError] = useState("");
  const [optionNotice, setOptionNotice] = useState("");

  async function loadInventory() {
    try {
      const response = await fetch("/api/inventory", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setRecords(await response.json() as InventoryRecord[]);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/inventory", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<InventoryRecord[]>;
      })
      .then((saved) => {
        if (active) {
          setRecords(saved);
          setLoadError(false);
        }
      })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/options", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<InventoryOptions>;
      })
      .then((options) => { if (active) setInventoryOptions(options); })
      .catch(() => { /* JSON defaults remain available if options cannot load. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
        setFormOpen(false);
        setImportOpen(false);
        setOptionsOpen(false);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  const categories = useMemo(() => Array.from(new Set(
    records
      .filter((record) => status === "all" || record.status === status)
      .map(categoryName),
  )).sort(), [records, status]);

  const mfgPartNumbers = useMemo(() => {
    const values = new Map<string, string>();
    records.forEach((record) => {
      const value = record.mfgPartNumber.trim();
      if (value && !values.has(value.toLowerCase())) values.set(value.toLowerCase(), value);
    });
    return [...values.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  }, [records]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter((record) => {
      if (status !== "all" && record.status !== status) return false;
      if (category !== "All categories" && categoryName(record) !== category) return false;
      if (!needle) return true;
      return [
        record.id, record.displayName, record.category, record.location, record.status,
        record.assignedTo, record.pid, record.mfgPartNumber, record.serialNumber, record.vendor, record.notes,
      ].join(" ").toLowerCase().includes(needle);
    });
  }, [records, query, status, category]);

  const statusValues = useMemo(
    () => Array.from(new Set([...inventoryOptions.statuses, ...records.map((record) => record.status)])),
    [inventoryOptions.statuses, records],
  );
  const filteredAvailable = filtered.filter((record) => record.status === "available");
  const filteredCheckedOut = filtered.filter((record) => record.status === "checked-out");
  const shown = filtered.slice(0, limit);

  function selectStatus(value: InventoryStatus | "all") {
    setStatus(value);
    setCategory("All categories");
    setLimit(PAGE_SIZE);
  }

  function openForm(record?: InventoryRecord) {
    setSelected(null);
    setEditingId(record?.id ?? "");
    setForm(record ? {
      status: record.status,
      assignedTo: record.assignedTo,
      displayName: record.displayName.trim(),
      recordDate: dateInputValue(record.recordDate),
      category: record.category,
      location: record.location,
      pid: record.pid,
      mfgPartNumber: record.mfgPartNumber,
      serialNumber: record.serialNumber,
      quantity: record.quantity,
      vendor: record.vendor,
      notes: record.notes,
    } : newEquipment());
    setFormError("");
    setDeleteError("");
    setFormOpen(true);
  }

  function setField<K extends keyof EquipmentInput>(key: K, value: EquipmentInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeStatus(value: InventoryStatus) {
    setForm((current) => {
      const restricted = value === "checked-out" || value === "infrastructure";
      return {
        ...current,
        status: value,
        assignedTo: value === "checked-out" ? current.assignedTo : "",
        location: restricted && current.location.toLowerCase() === "stockroom" ? "" : current.location,
      };
    });
  }

  async function saveEquipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/equipment", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...form, id: editingId } : form),
      });
      const result = await response.json() as { record?: InventoryRecord; error?: string };
      if (!response.ok || !result.record) throw new Error(result.error || "Equipment could not be saved");
      setRecords((current) => editingId
        ? current.map((record) => record.id === editingId ? result.record! : record)
        : [...current, result.record!]);
      setFormOpen(false);
      setEditingId("");
      setQuery("");
      selectStatus("all");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Equipment could not be saved");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEquipment() {
    if (!selected || deleting) return;
    const confirmed = window.confirm(
      "Delete " + selected.displayName + " (ID " + selected.id + ")? This action cannot be undone.",
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch("/api/equipment?id=" + encodeURIComponent(selected.id), {
        method: "DELETE",
      });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "Equipment could not be deleted");
      setRecords((current) => current.filter((record) => record.id !== selected.id));
      setSelected(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Equipment could not be deleted");
    } finally {
      setDeleting(false);
    }
  }

  function openImport() {
    setImportFileName("");
    setImportCsvText("");
    setImportPreview(null);
    setImportError("");
    setImportOpen(true);
  }

  async function previewCsv(file?: File) {
    if (!file) return;
    setImportFileName(file.name);
    setImportCsvText("");
    setImportPreview(null);
    setImportError("");
    setImportBusy(true);
    try {
      const csvText = await file.text();
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", csvText }),
      });
      const result = await response.json() as { preview?: CsvImportPreview; error?: string };
      if (!response.ok || !result.preview) throw new Error(result.error || "The CSV could not be previewed");
      setImportCsvText(csvText);
      setImportPreview(result.preview);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "The CSV could not be previewed");
    } finally {
      setImportBusy(false);
    }
  }

  async function importCsv() {
    if (!importPreview?.readyCount || !importCsvText || importBusy) return;
    setImportBusy(true);
    setImportError("");
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", csvText: importCsvText }),
      });
      const result = await response.json() as {
        preview?: CsvImportPreview;
        records?: InventoryRecord[];
        error?: string;
      };
      if (!response.ok || !result.preview || !result.records) {
        throw new Error(result.error || "The equipment could not be imported");
      }
      if (!result.records.length) {
        setImportPreview(result.preview);
        setImportError("No new records remain to import. Review the duplicate results.");
        return;
      }
      setRecords((current) => [...current, ...result.records!]
        .sort((left, right) => Number(left.id) - Number(right.id)));
      setImportNotice("Imported " + result.records.length + " equipment record" + (result.records.length === 1 ? "" : "s") + ". Duplicate and invalid rows were skipped.");
      setImportOpen(false);
      setImportCsvText("");
      setImportPreview(null);
      setQuery("");
      selectStatus("all");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "The equipment could not be imported");
    } finally {
      setImportBusy(false);
    }
  }

  function openOptions() {
    setOptionDrafts(emptyOptionDrafts());
    setOptionError("");
    setOptionNotice("");
    setOptionsOpen(true);
  }

  async function addOption(group: InventoryOptionGroup) {
    const value = optionDrafts[group].trim();
    if (!value || optionSaving) return;
    setOptionSaving(group);
    setOptionError("");
    setOptionNotice("");
    try {
      const response = await fetch("/api/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group, value }),
      });
      const result = await response.json() as {
        options?: InventoryOptions;
        value?: string;
        error?: string;
      };
      if (!response.ok || !result.options || !result.value) {
        throw new Error(result.error || "The option could not be added");
      }
      setInventoryOptions(result.options);
      setOptionDrafts((current) => ({ ...current, [group]: "" }));
      setOptionNotice(statusLabel(result.value) + " was added.");
    } catch (error) {
      setOptionError(error instanceof Error ? error.message : "The option could not be added");
    } finally {
      setOptionSaving("");
    }
  }

  const statusTabs: Array<[InventoryStatus | "all", string, number]> = [
    ["all", "All", records.length],
    ...statusValues.map((value) => [
      value,
      statusLabel(value),
      records.filter((record) => record.status === value).length,
    ] as [InventoryStatus, string, number]),
  ];

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Inventory home">
          <span className="brand-mark" aria-hidden="true">ID</span>
          <span><strong>Inventory Dashboard</strong><small>LAB OPERATIONS</small></span>
        </a>
        <div className="topbar-meta"><span className="sync-dot" aria-hidden="true" />Cloud database<span className="meta-rule" />Live inventory</div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">EQUIPMENT MANAGEMENT</p>
          <h1>Inventory lookup</h1>
          <p className="hero-subtitle">Find equipment by PID, MFG part number, serial, location, availability, vendor, or notes.</p>
        </div>
        <div className="search-panel">
          <label htmlFor="inventory-search">Search all inventory fields</label>
          <div className="search-box">
            <span aria-hidden="true">⌕</span>
            <input id="inventory-search" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(PAGE_SIZE); }} placeholder="Try “QSFP-100G”, “FVH291” or “LITEON”" autoComplete="off" />
            {query && <button className="clear-search" onClick={() => setQuery("")} aria-label="Clear search">×</button>}
          </div>
        </div>
      </section>

      <section className="content-wrap">
        <div className="metric-grid" aria-label="Inventory summary">
          <article className="metric-card accent-card"><div><small>AVAILABLE UNITS</small><strong>{filteredAvailable.reduce((sum, record) => sum + Number(record.quantity || 0), 0)}</strong></div><p>Ready for assignment</p></article>
          <article className="metric-card"><div><small>EQUIPMENT RECORDS</small><strong>{filtered.length}</strong></div><p>Matching inventory records</p></article>
          <article className="metric-card"><div><small>SERIALIZED</small><strong>{filtered.filter((record) => record.serialNumber).length}</strong></div><p>Records with traceable serial numbers</p></article>
          <article className="metric-card"><div><small>CHECKED OUT UNITS</small><strong>{filteredCheckedOut.reduce((sum, record) => sum + Number(record.quantity || 0), 0)}</strong></div><p>Assigned to a user</p></article>
        </div>

        <section className="inventory-card" aria-labelledby="inventory-title">
          <div className="inventory-head">
            <div><p className="eyebrow dark">BROWSE STOCK</p><h2 id="inventory-title">Inventory records</h2></div>
            <div className="head-actions"><button className="primary-button" onClick={() => openForm()}>+ New equipment</button><button className="secondary-button" onClick={openOptions}>Manage options</button><button className="secondary-button" onClick={openImport}>Import CSV</button><a className="export-link" href="/api/export" download>↓ Export CSV</a></div>
          </div>
          {importNotice && <p className="import-notice" role="status">{importNotice}</p>}
          <div className="toolbar">
            <div className="status-tabs" aria-label="Availability status">
              {statusTabs.map(([value, label, count]) => <button key={value} className={status === value ? "active" : ""} onClick={() => selectStatus(value)}>{label} <span>{count}</span></button>)}
            </div>
            <label className="select-wrap"><span>Category</span><select value={category} onChange={(event) => { setCategory(event.target.value); setLimit(PAGE_SIZE); }}><option>All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
          </div>

          {loading ? <div className="loading-state"><span /><p>Loading inventory records…</p></div>
            : loadError ? <div className="empty-state"><strong>Inventory data didn’t load.</strong><p>Refresh the page to try again.</p><button onClick={() => void loadInventory()}>Try again</button></div>
            : filtered.length === 0 ? <div className="empty-state"><strong>No matching hardware</strong><p>Try another identifier or clear your filters.</p><button onClick={() => { setQuery(""); selectStatus("all"); }}>Clear filters</button></div>
            : <>
              <div className="result-line"><span><strong>{filtered.length}</strong> records</span>{query && <span>matching “{query}”</span>}</div>
              <div className="table-wrap"><table><thead><tr><th>Item</th><th>Identifiers</th><th>Details</th><th>Location</th><th className="qty-col">Qty</th><th>Availability</th><th aria-label="Open details" /></tr></thead><tbody>
                {shown.map((record) => <tr key={record.id} onClick={() => setSelected(record)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") setSelected(record); }}>
                  <td><strong className="item-name">{record.displayName}</strong><span className="category-tag">{categoryName(record)}</span></td>
                  <td><code>{record.pid || "n/a"}</code><small>{record.mfgPartNumber || "No MFG part number"} · {record.serialNumber || "No serial number"}</small></td>
                  <td><strong>{record.vendor || "Vendor not listed"}</strong><small>{record.status === "checked-out" && record.assignedTo ? `Assigned to ${record.assignedTo}` : record.notes || "No notes"}</small></td>
                  <td><strong>{record.location || "—"}</strong></td><td className="qty-col"><span className="qty-badge">{record.quantity}</span></td>
                  <td><span className={`availability-pill ${record.status}`}>{statusLabel(record.status)}</span></td>
                  <td><button className="row-open" aria-label={`Open ${record.displayName} details`}>→</button></td>
                </tr>)}
              </tbody></table></div>
              {shown.length < filtered.length && <button className="load-more" onClick={() => setLimit((value) => value + PAGE_SIZE)}>Show more <span>{filtered.length - shown.length} remaining</span></button>}
            </>}
        </section>
        <footer><span>Cloud-backed inventory database</span><span>•</span><span>Sequential entry IDs</span><span className="footer-spacer" /><a href="#top">Back to top ↑</a></footer>
      </section>

      {selected && <div className="drawer-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }}><aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <button className="drawer-close" onClick={() => setSelected(null)} aria-label="Close details">×</button><p className="eyebrow dark">RECORD DETAIL</p><h2 id="drawer-title">{selected.displayName}</h2>
        <div className="drawer-tags"><span>ID {selected.id}</span><span>{categoryName(selected)}</span><span className={selected.status}>{statusLabel(selected.status)}</span></div>
        <div className="detail-quantity"><small>QUANTITY</small><strong>{selected.quantity}</strong></div>
        <dl>{[
          ["Availability", statusLabel(selected.status)], ["Assigned user", selected.assignedTo], ["Location", selected.location],
          ["PID", selected.pid], ["MFG Part number", selected.mfgPartNumber], ["Serial number", selected.serialNumber], ["Vendor", selected.vendor],
          ["Record date", selected.recordDate], ["Notes", selected.notes],
        ].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="preserve-lines">{value}</dd></div>)}</dl>
        <p className="form-error" role="alert">{deleteError}</p>
        <div className="drawer-actions"><button className="danger-button" onClick={() => void deleteEquipment()} disabled={deleting}>{deleting ? "Deleting…" : "Delete item"}</button><button className="primary-button" onClick={() => openForm(selected)} disabled={deleting}>Edit record</button></div>
      </aside></div>}

      {optionsOpen && <div className="form-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !optionSaving) setOptionsOpen(false); }}><section className="form-modal options-modal" role="dialog" aria-modal="true" aria-labelledby="options-title">
        <button className="drawer-close" onClick={() => setOptionsOpen(false)} aria-label="Close option manager" disabled={Boolean(optionSaving)}>×</button>
        <p className="eyebrow dark">CONTROLLED LISTS</p><h2 id="options-title">Manage form options</h2>
        <p className="form-intro">Add values to the required equipment fields. New options are stored in the cloud database and become available immediately.</p>
        <div className="options-grid">
          {OPTION_GROUPS.map(({ group, label, placeholder, helper }) => <form className="option-card" key={group} onSubmit={(event) => { event.preventDefault(); void addOption(group); }}>
            <label><span>{label}</span><input required maxLength={group === "statuses" ? 60 : group === "equipmentNames" ? 160 : 120} value={optionDrafts[group]} onChange={(event) => setOptionDrafts((current) => ({ ...current, [group]: event.target.value }))} placeholder={placeholder} /></label>
            <p>{helper}</p>
            <div className="option-card-actions"><span>{inventoryOptions[group].length} current</span><button className="primary-button" type="submit" disabled={Boolean(optionSaving) || !optionDrafts[group].trim()}>{optionSaving === group ? "Adding…" : "Add"}</button></div>
            <details><summary>View current options</summary><div className="option-value-list">{inventoryOptions[group].map((value) => <span key={value}>{group === "statuses" ? statusLabel(value) : value}</span>)}</div></details>
          </form>)}
        </div>
        <p className="option-success" role="status">{optionNotice}</p>
        <p className="form-error" role="alert">{optionError}</p>
        <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setOptionsOpen(false)} disabled={Boolean(optionSaving)}>Close</button></div>
      </section></div>}

      {importOpen && <div className="form-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !importBusy) setImportOpen(false); }}><section className="form-modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <button className="drawer-close" onClick={() => setImportOpen(false)} aria-label="Close CSV import" disabled={importBusy}>×</button>
        <p className="eyebrow dark">BULK ENTRY</p><h2 id="import-title">Import equipment CSV</h2>
        <p className="form-intro">Use the same 13 columns as inventory.csv. Select a file to check duplicates before importing. Uploaded ID values are ignored; new sequential IDs are assigned by the database.</p>
        <div className="import-upload">
          <label className="csv-select-button"><span>{importBusy ? "Checking CSV…" : importFileName ? "Choose another CSV" : "Select CSV to import"}</span><input className="file-input-hidden" type="file" accept=".csv,text/csv" disabled={importBusy} onChange={(event) => void previewCsv(event.target.files?.[0])} /></label>
          <a className="export-link" href="/api/export" download>Download CSV template</a>
        </div>
        {importFileName && <p className="selected-file">Selected: <strong>{importFileName}</strong></p>}
        {importBusy && !importPreview && <div className="import-loading" role="status">Checking rows and duplicates…</div>}
        <p className="form-error" role="alert">{importError}</p>
        {importPreview && <>
          <div className="import-summary" aria-label="CSV import summary">
            <div><strong>{importPreview.totalRows}</strong><span>Total rows</span></div>
            <div className="ready"><strong>{importPreview.readyCount}</strong><span>Ready</span></div>
            <div className="duplicate"><strong>{importPreview.duplicateCount}</strong><span>Duplicates</span></div>
            <div className="invalid"><strong>{importPreview.invalidCount}</strong><span>Invalid</span></div>
          </div>
          <p className="import-rule">Existing serial numbers are duplicates. Rows without serial numbers are duplicates only when every equipment field matches.</p>
          <div className="import-table-wrap"><table className="import-table"><thead><tr><th>Row</th><th>Equipment</th><th>Serial</th><th>Result</th></tr></thead><tbody>
            {importPreview.rows.slice(0, 100).map((row) => <tr key={row.row}><td>{row.row}</td><td>{row.displayName || "—"}</td><td>{row.serialNumber || "—"}</td><td><span className={"import-status " + row.status}>{row.status}</span><small>{row.reason}</small></td></tr>)}
          </tbody></table></div>
          {importPreview.rows.length > 100 && <p className="import-rule">Showing the first 100 of {importPreview.rows.length} checked rows.</p>}
        </>}
        <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setImportOpen(false)} disabled={importBusy}>Cancel</button><button type="button" className="primary-button" onClick={() => void importCsv()} disabled={importBusy || !importPreview?.readyCount}>{importBusy && importPreview ? "Importing…" : importPreview ? "Import " + importPreview.readyCount + " ready records" : "Select a CSV first"}</button></div>
      </section></div>}

      {formOpen && <div className="form-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setFormOpen(false); }}><section className="form-modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <button className="drawer-close" onClick={() => setFormOpen(false)} aria-label="Close form">×</button><p className="eyebrow dark">MANUAL ENTRY</p><h2 id="form-title">{editingId ? "Edit equipment" : "Add new equipment"}</h2>
        <p className="form-intro">PID, MFG part number, serial number, vendor, and notes are optional. Equipment type, name, location, and availability use controlled lists.</p>
        <form onSubmit={saveEquipment}><div className="form-grid">
          <label className="full-field"><span>Equipment type</span><select required value={form.category} onChange={(event) => setField("category", event.target.value)}><option value="">Select a type</option>{inventoryOptions.equipmentTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="full-field"><span>Location</span><select required value={form.location} onChange={(event) => setField("location", event.target.value)}><option value="">Select a location</option>{inventoryOptions.locations.map((value) => <option key={value} disabled={(form.status === "checked-out" || form.status === "infrastructure") && value.toLowerCase() === "stockroom"}>{value}</option>)}</select></label>
          <label className="full-field"><span>Availability status</span><select required value={form.status} onChange={(event) => changeStatus(event.target.value as InventoryStatus)}>{inventoryOptions.statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
          {form.status === "checked-out" && <label className="full-field"><span>Assigned user</span><input required maxLength={120} value={form.assignedTo} onChange={(event) => setField("assignedTo", event.target.value)} placeholder="Enter the person using this equipment" /></label>}
          <label><span>Equipment name</span><select required value={form.displayName} onChange={(event) => setField("displayName", event.target.value)}><option value="">Select a name</option>{inventoryOptions.equipmentNames.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Record date</span><input required type="date" value={form.recordDate} onChange={(event) => setField("recordDate", event.target.value)} /></label>
          <label><span>PID (optional)</span><input maxLength={160} value={form.pid} onChange={(event) => setField("pid", event.target.value)} placeholder="n/a" /></label>
          <label><span>MFG Part number (optional)</span><input list="mfg-part-number-options" maxLength={160} autoComplete="off" value={form.mfgPartNumber} onChange={(event) => setField("mfgPartNumber", event.target.value)} /><datalist id="mfg-part-number-options">{mfgPartNumbers.map((value) => <option key={value} value={value} />)}</datalist></label>
          <label><span>Serial number (optional)</span><input maxLength={160} value={form.serialNumber} onChange={(event) => setField("serialNumber", event.target.value)} /></label>
          <label><span>Quantity</span><input required type="number" min={1} max={10000} value={form.quantity} onChange={(event) => setField("quantity", Number(event.target.value))} /></label>
          <label><span>Vendor (optional)</span><input maxLength={120} value={form.vendor} onChange={(event) => setField("vendor", event.target.value)} /></label>
          <label className="full-field"><span>Notes (optional)</span><textarea maxLength={1000} rows={3} value={form.notes} onChange={(event) => setField("notes", event.target.value)} /></label>
        </div><p className="form-error" role="alert">{formError}</p><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add equipment"}</button></div></form>
      </section></div>}
    </main>
  );
}
