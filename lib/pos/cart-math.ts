import { round2 } from "@/lib/utils";
import type { CartItem, CartTotals, ComputedLine, OrderDiscount } from "./types";
import type { TaxSettings } from "@/types/database";

/**
 * All cart math lives here so the POS screen, held-order preview and receipt
 * agree on the same numbers. Simplification: tax is a single rate taken from
 * `tax_settings` (business-wide), not the per-product tax_enabled/tax_rate
 * columns — this matches the spec's "tax (from tax_settings)" wording and
 * keeps the math easy to audit. Order-level discount and tax are prorated
 * across lines (by each line's share of the post-item-discount subtotal) so
 * every order_item row still carries a sensible discount/tax/line_total.
 */

/** Discount amount for a single cart line, capped so it never exceeds the line's own subtotal. */
export function calcItemDiscountAmount(item: CartItem): number {
  const lineSubtotal = round2(item.unitPrice * item.quantity);
  if (!item.discountType || !item.discountValue) return 0;
  const raw =
    item.discountType === "percentage" ? (lineSubtotal * item.discountValue) / 100 : item.discountValue;
  return round2(Math.min(Math.max(raw, 0), lineSubtotal));
}

/** Order-level discount amount, capped to the discountable base (subtotal minus item-level discounts). */
export function calcOrderDiscountAmount(base: number, discount: OrderDiscount): number {
  if (!discount.type || !discount.value) return 0;
  const raw = discount.type === "percentage" ? (base * discount.value) / 100 : discount.value;
  return round2(Math.min(Math.max(raw, 0), base));
}

export function computeCartTotals(
  cart: CartItem[],
  orderDiscount: OrderDiscount,
  taxSettings: Pick<TaxSettings, "enabled" | "percentage" | "price_inclusive"> | null
): CartTotals {
  const subtotal = round2(cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0));
  const itemDiscountTotal = round2(cart.reduce((s, i) => s + calcItemDiscountAmount(i), 0));
  const baseForOrderDiscount = round2(Math.max(subtotal - itemDiscountTotal, 0));
  const orderDiscountAmount = calcOrderDiscountAmount(baseForOrderDiscount, orderDiscount);
  const discountedSubtotal = round2(Math.max(baseForOrderDiscount - orderDiscountAmount, 0));

  const taxEnabled = !!taxSettings?.enabled;
  const rate = taxSettings?.percentage ?? 0;
  const priceInclusive = taxSettings?.price_inclusive ?? true;

  const lines: ComputedLine[] = [];
  let taxAmount = 0;
  let orderDiscountAllocated = 0;

  cart.forEach((item, idx) => {
    const isLast = idx === cart.length - 1;
    const lineSubtotal = round2(item.unitPrice * item.quantity);
    const itemDiscount = calcItemDiscountAmount(item);
    const afterItemDiscount = round2(lineSubtotal - itemDiscount);
    const share = baseForOrderDiscount > 0 ? afterItemDiscount / baseForOrderDiscount : 0;

    // Give the last line whatever's left so proration rounding always sums exactly.
    const lineOrderDiscount = isLast
      ? round2(orderDiscountAmount - orderDiscountAllocated)
      : round2(orderDiscountAmount * share);
    orderDiscountAllocated = round2(orderDiscountAllocated + lineOrderDiscount);

    const lineDiscountedSubtotal = round2(Math.max(afterItemDiscount - lineOrderDiscount, 0));
    let lineTax = 0;
    if (taxEnabled && rate > 0) {
      lineTax = priceInclusive
        ? round2(lineDiscountedSubtotal - lineDiscountedSubtotal / (1 + rate / 100))
        : round2((lineDiscountedSubtotal * rate) / 100);
    }
    const lineTotal = priceInclusive ? lineDiscountedSubtotal : round2(lineDiscountedSubtotal + lineTax);

    taxAmount = round2(taxAmount + lineTax);

    lines.push({
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      itemDiscountAmount: round2(itemDiscount + lineOrderDiscount),
      taxAmount: lineTax,
      lineTotal,
      notes: item.notes || null,
    });
  });

  const total = priceInclusive ? discountedSubtotal : round2(discountedSubtotal + taxAmount);

  return {
    lines,
    subtotal,
    itemDiscountTotal,
    orderDiscountAmount,
    discountAmount: round2(itemDiscountTotal + orderDiscountAmount),
    taxAmount,
    total,
  };
}

/** Caps a requested discount percent to the role's `discount_limits` row. Unlimited roles pass through. */
export function capDiscountPercent(requestedPercent: number, limit: { unlimited: boolean; max_percent: number | null } | null): number {
  if (!limit || limit.unlimited) return requestedPercent;
  const max = limit.max_percent ?? 0;
  return Math.min(requestedPercent, max);
}
