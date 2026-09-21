// Hand-written types matching supabase/migrations/001_initial_schema.sql.
// Regenerate with `supabase gen types typescript` once your project is live
// if you want fully generated types instead.

export type UserRole = "administrator" | "manager" | "cashier";
export type OrderType = "takeaway" | "pickup" | "dine_in";
export type OrderStatus = "new" | "preparing" | "ready" | "completed" | "cancelled";
export type SyncStatus = "synced" | "pending" | "failed";
export type DiscountKind = "percentage" | "fixed";
export type InventoryTxnType =
  | "sale"
  | "purchase"
  | "adjustment"
  | "damaged"
  | "wasted"
  | "returned"
  | "manual_correction"
  | "refund";
export type PurchaseStatus = "draft" | "received" | "cancelled";
export type PurchasePaymentStatus = "unpaid" | "partial" | "paid";
export type RegisterStatus = "open" | "closed";
export type RegisterTxnType = "cash_sale" | "cash_refund" | "cash_in" | "cash_out" | "opening_float";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  active: boolean;
  max_discount_percent: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  icon: string | null;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  description: string | null;
  selling_price: number;
  cost_price: number;
  current_stock: number;
  minimum_stock: number;
  unit: string;
  image_url: string | null;
  active: boolean;
  track_inventory: boolean;
  tax_enabled: boolean;
  tax_rate: number;
  created_at: string;
  updated_at: string;
}

/** Bill-of-materials row: `product_id` consumes `quantity` units of `ingredient_product_id` per 1 unit sold. */
export interface RecipeItem {
  id: string;
  product_id: string;
  ingredient_product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  client_txn_id: string | null;
  order_type: OrderType;
  status: OrderStatus;
  customer_id: string | null;
  cashier_id: string;
  register_id: string | null;
  subtotal: number;
  discount_type: DiscountKind | null;
  discount_value: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  pickup_time: string | null;
  sync_status: SyncStatus;
  voided: boolean;
  voided_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  item_discount_amount: number;
  tax_amount: number;
  line_total: number;
  notes: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  payment_method_id: string;
  amount: number;
  amount_received: number | null;
  change_amount: number;
  reference: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  enabled: boolean;
  display_order: number;
}

export interface InventoryTransaction {
  id: string;
  product_id: string;
  type: InventoryTxnType;
  quantity_change: number;
  resulting_stock: number;
  reference_type: string | null;
  reference_id: string | null;
  reason: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Purchase {
  id: string;
  supplier_id: string | null;
  invoice_number: string | null;
  purchase_date: string;
  status: PurchaseStatus;
  payment_status: PurchasePaymentStatus;
  total_cost: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  received_at: string | null;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  cost_price: number;
  total_cost: number;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  active: boolean;
}

export interface Expense {
  id: string;
  category_id: string | null;
  amount: number;
  description: string | null;
  expense_date: string;
  payment_method_id: string | null;
  reference: string | null;
  attachment_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CashRegister {
  id: string;
  cashier_id: string;
  opening_cash: number;
  opening_notes: string | null;
  status: RegisterStatus;
  closing_cash_expected: number | null;
  closing_cash_actual: number | null;
  difference: number | null;
  closing_notes: string | null;
  opened_at: string;
  closed_at: string | null;
}

export interface CashRegisterTransaction {
  id: string;
  register_id: string;
  type: RegisterTxnType;
  amount: number;
  reason: string | null;
  notes: string | null;
  reference_order_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Refund {
  id: string;
  order_id: string;
  reason: string;
  refund_amount: number;
  authorized_by: string;
  created_by: string;
  created_at: string;
}

export interface RefundItem {
  id: string;
  refund_id: string;
  order_item_id: string;
  quantity: number;
  refund_amount: number;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
}

export interface VoidRequest {
  id: string;
  order_id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  created_at: string;
  reviewed_by: string | null;
  review_note: string | null;
  reviewed_at: string | null;
}

export interface AppNotification {
  id: string;
  user_id: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface BusinessSettings {
  id: true;
  business_name: string;
  logo_url: string | null;
  address: string;
  phone: string;
  email: string;
  receipt_footer: string;
  currency: string;
  default_order_type: OrderType;
  kitchen_screen_enabled: boolean;
  dine_in_enabled: boolean;
  updated_at: string;
}

export interface TaxSettings {
  id: true;
  enabled: boolean;
  name: string;
  percentage: number;
  price_inclusive: boolean;
  updated_at: string;
}

export interface DiscountLimit {
  role: UserRole;
  max_percent: number | null;
  unlimited: boolean;
}
