import Papa from "papaparse";

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

function toBool(v: string | undefined): boolean {
  return (v ?? "").trim().toLowerCase() === "yes" || (v ?? "").trim().toLowerCase() === "true";
}

function toNum(v: string | undefined): number {
  const n = Number((v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

/** Parses Ewity's "Other Units" column: comma-separated "name:scale" pairs, e.g. "box:4,case:12". */
function parseOtherUnits(raw: string | undefined, defaultUnitName: string | undefined, warnings: string[], rowNumber: number): ParsedOtherUnit[] {
  const text = (raw ?? "").trim();
  if (!text) return [];
  const defaultName = (defaultUnitName ?? "").trim().toLowerCase();
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
 * Parses an Ewity-style "Import Variant Products" CSV export.
 *
 * Shape: one header row, then one row per SKU/variant. Product-level columns (Product Name, Is
 * Inventory Tracked, Brand, Category, Supplier, Description, any "Tax_*" column, any "Location_*"
 * column, Base Unit, Other Units, Default Unit, Attr 1/2/3 names) are only filled in on the FIRST
 * row of each product and blank on the rows below it — a new product starts whenever "Product
 * Name" is non-empty. Per-variant columns (Attr 1/2/3 Value, Barcode, Sku, the "Stock_*" column,
 * Cost Price, Sales Price, Image URL) are given on every row.
 */
export function parseEwityVariantCsv(csvText: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    for (const e of parsed.errors) errors.push(`Row ${e.row ?? "?"}: ${e.message}`);
  }

  const fields = parsed.meta.fields ?? [];
  const taxColumns = fields.filter((f) => f.toLowerCase().startsWith("tax_"));
  const stockColumn = fields.find((f) => f.toLowerCase().startsWith("stock_"));

  if (!fields.includes("Product Name")) {
    errors.push('This file has no "Product Name" column — it doesn\'t look like an Ewity variant-products export.');
    return { groups: [], errors, warnings };
  }

  const groups: ParsedProductGroup[] = [];
  let current: ParsedProductGroup | null = null;

  parsed.data.forEach((raw, idx) => {
    const rowNumber = idx + 2; // +1 for header, +1 for 1-indexing
    const productName = (raw["Product Name"] ?? "").trim();

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
      const attrNames = [raw["Attr 1"], raw["Attr 2"], raw["Attr 3"]]
        .map((a) => (a ?? "").trim())
        .filter(Boolean);

      current = {
        name: productName,
        trackInventory: raw["Is Inventory Tracked"] === undefined ? true : toBool(raw["Is Inventory Tracked"]),
        categoryName: (raw["Category"] ?? "").trim() || null,
        description: (raw["Description"] ?? "").trim() || null,
        baseUnit: (raw["Base Unit"] ?? "").trim() || "pc",
        otherUnits: parseOtherUnits(raw["Other Units"], raw["Default Unit"], warnings, rowNumber),
        attrNames,
        taxEnabled,
        taxRate,
        rows: [],
        isVariantGroup: false,
      };
      groups.push(current);
    }

    if (!current) {
      warnings.push(`Row ${rowNumber}: skipped — no product name above it to attach to.`);
      return;
    }

    const attrValues = [raw["Attr 1 Value"], raw["Attr 2 Value"], raw["Attr 3 Value"]]
      .map((a) => (a ?? "").trim())
      .filter(Boolean);

    current.rows.push({
      rowNumber,
      attrValues,
      barcode: (raw["Barcode"] ?? "").trim(),
      sku: (raw["Sku"] ?? "").trim(),
      stock: stockColumn ? toNum(raw[stockColumn]) : 0,
      costPrice: toNum(raw["Cost Price"]),
      sellingPrice: toNum(raw["Sales Price"]),
      imageUrl: (raw["Image URL"] ?? "").trim(),
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

export function variantLabel(row: ParsedVariantRow): string {
  return row.attrValues.join(" / ");
}
