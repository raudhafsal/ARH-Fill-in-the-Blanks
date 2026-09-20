import type { DiscountKind, OrderType } from "@/types/database";

/** A line in the in-progress cart (client-side only, before a sale is completed). */
export interface CartItem {
  /** Client-side unique id for this line (allows the same product twice with different notes). */
  lineId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes: string;
  discountType: DiscountKind | null;
  discountValue: number; // percent (0-100) when discountType === 'percentage', else an MVR amount
  taxEnabled: boolean;
  taxRate: number;
}

/** A computed line, ready to send to the complete_sale RPC. */
export interface ComputedLine {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  itemDiscountAmount: number;
  taxAmount: number;
  lineTotal: number;
  notes: string | null;
}

export interface CartTotals {
  lines: ComputedLine[];
  subtotal: number; // gross, before any discount
  itemDiscountTotal: number;
  orderDiscountAmount: number;
  discountAmount: number; // itemDiscountTotal + orderDiscountAmount
  taxAmount: number;
  total: number;
}

export interface OrderDiscount {
  type: DiscountKind | null;
  value: number;
}

export interface PendingPayment {
  paymentMethodId: string;
  amount: number;
  amountReceived: number | null;
  changeAmount: number;
  reference: string | null;
}

/** Args for the complete_sale RPC, kept as one shape used live and for the offline queue. */
export interface CompleteSalePayload {
  p_client_txn_id: string;
  p_order_type: OrderType;
  p_customer_id: string | null;
  p_register_id: string | null;
  p_subtotal: number;
  p_discount_type: DiscountKind | null;
  p_discount_value: number;
  p_discount_amount: number;
  p_tax_amount: number;
  p_total: number;
  p_notes: string | null;
  p_items: {
    product_id: string | null;
    product_name: string;
    unit_price: number;
    quantity: number;
    item_discount_amount: number;
    tax_amount: number;
    line_total: number;
    notes: string | null;
  }[];
  p_payments: {
    payment_method_id: string;
    amount: number;
    amount_received: number | null;
    change_amount: number;
    reference: string | null;
  }[];
}

/** Everything the receipt component needs, gathered from `orders` + joins (or from an offline-queued sale). */
export interface ReceiptData {
  orderNumber: string;
  createdAt: string;
  cashierName: string;
  orderType: OrderType;
  notes: string | null;
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    itemDiscountAmount: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  taxName: string;
  total: number;
  payments: {
    methodName: string;
    amount: number;
    amountReceived: number | null;
    changeAmount: number;
  }[];
  syncStatus?: "synced" | "pending" | "failed";
}

export interface HeldOrder {
  id: string;
  heldAt: string;
  cart: CartItem[];
  orderType: OrderType;
  orderNotes: string;
  customerId: string | null;
  customerName: string | null;
  orderDiscount: OrderDiscount;
}
