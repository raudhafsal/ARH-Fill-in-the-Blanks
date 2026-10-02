import Papa from "papaparse";

/** A raw cell value as it comes out of either a CSV row or an Excel row. */
type Cell = string | number | boolean | null | undefined;
type RawRow = Record<string, Cell>;

/** One variant/product row after parsing — the fields that differ per row (never forward-filled). */
export interface ParsedVariantRow {
  rowNumber: number;
  attrValues: string[]; // e.g. ["S", "Red"] — empty strings dropped
  barcode: string;
  sku: string;
  stock: number;
  costPrice: number;
  sellingPrice: number;
  imageUrl: string;
}

export interface ParsedOtherUnit {
  name: string;
  scale: number;
  isDefault: boolean;
}

/** One product (or variant group, if it has >1 row / attribute values) after grouping consecutive rows. */
export interface ParsedProductGroup {
  name: string;
  trackInventory: boolean;
  categoryName: string | null;
  description: string | null;
  baseUnit: string;
  otherUnits: ParsedOtherUnit[];
  attrNames: string[]; // e.g. ["Size", "Color"]
  taxEnabled: boolean;
  taxRate: number;
  rows: ParsedVariantRow[];
  isVariantGroup: boolean;
}

export interface ParseResult {
  groups: ParsedProductGroup[];
  errors: string[];
  warnings: string[];
}

function str(v: Cell): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toBool(v: Cell): boolean {
  const s = str(v).toLowerCase();
  return s === "yes" || s === "true";
}

function toNum(v: Cell): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(str(v));
  return Number.isFinite(n) ? n : 0;
}

/** Parses Ewity's "Other Units" column: comma-separated "name:scale" pairs, e.g. "box:4,case:12". */
function parseOtherUnits(raw: Cell, defaultUnitName: Cell, warnings: string[], rowNumber: number): ParsedOtherUnit[] {
  const text = str(raw);
  if (!text) return [];
  const defaultName = str(defaultUnitName).toLowerCase();
  const units: ParsedOtherUnit[] = [];
  for (const part of text.split(",")) {
    const [namePart, scalePart] = part.split(":").map((s) => s.trim());
    if (!namePart) continue;
    const scale = Number(scalePart);
    if (!scalePart || !Number.isFinite(scale) || scale <= 0) {
      warnings.push(`Row ${rowNumber}: couldn't read the scale for unit "${namePart}" in "Other Units" — skipped it.`);
      continue;
    }
    units.push({ name: namePart, scale, isDefault: namePart.toLowerCase() === defaultName });
  }
  return units;
}

/**
 * Groups already-parsed rows (from either a CSV or an Excel sheet) into products/variant groups.
 *
 * Shape: one header row (consumed by the caller), then one row per SKU/variant. Product-level
 * columns (Product Name, Is Inventory Tracked, Brand, Category, Supplier, Description, any
 * "Tax_*" column, any "Location_*" column, Base Unit, Other Units, Default Unit, Attr 1/2/3
 * names) are only filled in on the FIRST row of each product and blank on the rows below it — a
 * new product starts whenever "Product Name" is non-empty. Per-variant columns (Attr 1/2/3
 * Value, Barcode, Sku, the "Stock_*" column, Cost Price, Sales Price, Image URL) are given on
 * every row.
 */
function groupEwityRows(rows: RawRow[], fields: string[]): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const taxColumns = fields.filter((f) => f.toLowerCase().startsWith("tax_"));
  const stockColumn = fields.find((f) => f.toLowerCase().startsWith("stock_"));

  if (!fields.includes("Product Name")) {
    errors.push('This file has no "Product Name" column — it doesn\'t look like an Ewity variant-products export.');
    return { groups: [], errors, warnings };
  }

  const groups: ParsedProductGroup[] = [];
  let current: ParsedProductGroup | null = null;

  rows.forEach((raw, idx) => {
    const rowNumber = idx + 2; // +1 for header, +1 for 1-indexing
    const productName = str(raw["Product Name"]);

    if (productName) {
      // Start a new group — read product-level columns from this row.
      let taxEnabled = false;
      let taxRate = 0;
      for (const col of taxColumns) {
        if (toBool(raw[col])) {
          taxEnabled = true;
          const m = col.match(/(\d+(\.\d+)?)\s*%/);
          if (m) taxRate += Number(m[1]);
        }
      }
      const attrNames = [raw["Attr 1"], raw["Attr 2"], raw["Attr 3"]].map(str).filter(Boolean);

      current = {
        name: productName,
        trackInventory: raw["Is Inventory Tracked"] === undefined ? true : toBool(raw["Is Inventory Tracked"]),
        categoryName: str(raw["Category"]) || null,
        description: str(raw["Description"]) || null,
        baseUnit: str(raw["Base Unit"]) || "pc",
        otherUnits: parseOtherUnits(raw["Other Units"], raw["Default Unit"], warnings, rowNumber),
        attrNames,
        taxEnabled,
        taxRate,
        rows: [],
        isVariantGroup: false,
      };
      groups.push(current);
    }

    const isBlankRow = Object.values(raw).every((v) => str(v) === "");
    if (isBlankRow) return;

    if (!current) {
      warnings.push(`Row ${rowNumber}: skipped — no product name above it to attach to.`);
      return;
    }

    const attrValues = [raw["Attr 1 Value"], raw["Attr 2 Value"], raw["Attr 3 Value"]].map(str).filter(Boolean);

    current.rows.push({
      rowNumber,
      attrValues,
      barcode: str(raw["Barcode"]),
      sku: str(raw["Sku"]),
      stock: stockColumn ? toNum(raw[stockColumn]) : 0,
      costPrice: toNum(raw["Cost Price"]),
      sellingPrice: toNum(raw["Sales Price"]),
      imageUrl: str(raw["Image URL"]),
    });
  });

  for (const g of groups) {
    g.isVariantGroup = g.rows.length > 1 || g.rows.some((r) => r.attrValues.length > 0);
    if (g.rows.length === 0) {
      errors.push(`"${g.name}": no variant rows found.`);
    }
  }

  return { groups, errors, warnings };
}

/** Parses an Ewity-style "Import Variant Products" CSV export (plain text). */
export function parseEwityVariantCsv(csvText: string): ParseResult {
  const parsed = Papa.parse<RawRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const parseErrors = parsed.errors.map((e) => `Row ${e.row ?? "?"}: ${e.message}`);

  const fields = parsed.meta.fields ?? [];
  const result = groupEwityRows(parsed.data, fields);
  return { ...result, errors: [...parseErrors, ...result.errors] };
}

/**
 * Parses an Ewity-style "Import Variant Products" export saved as an Excel (.xlsx/.xls) file.
 * Loads the (large) xlsx library on demand so pages that only ever handle CSVs don't pay for it.
 */
export async function parseEwityVariantXlsx(buffer: ArrayBuffer): Promise<ParseResult> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { groups: [], errors: ["This Excel file has no sheets."], warnings: [] };
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "", raw: true });
  const fields = rows.length > 0 ? Object.keys(rows[0]) : [];
  return groupEwityRows(rows, fields);
}

export function variantLabel(row: ParsedVariantRow): string {
  return row.attrValues.join(" / ");
}
