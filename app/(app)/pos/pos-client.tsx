"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatMVR, generateClientTxnId } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { computeCartTotals } from "@/lib/pos/cart-math";
import { enqueueSale, retryAll } from "@/lib/pos/offline-queue";
import { holdOrder, listHeldOrders, discardHeldOrder } from "@/lib/pos/held-orders";
import { usePosKeyboardShortcuts } from "@/lib/pos/use-keyboard-shortcuts";
import { useBarcodeScanner } from "@/lib/pos/use-barcode-scanner";
import type { CartItem, CompleteSalePayload, HeldOrder, OrderDiscount, ReceiptData } from "@/lib/pos/types";
import type {
  BusinessSettings,
  CashRegister,
  Category,
  DiscountLimit,
  OrderType,
  PaymentMethod,
  Product,
  Profile,
  TaxSettings,
} from "@/types/database";

import { CategoryTabs } from "@/components/pos/category-tabs";
import { ProductGrid } from "@/components/pos/product-grid";
import { CartPanel } from "@/components/pos/cart-panel";
import { CartItemEditDialog } from "@/components/pos/cart-item-edit-dialog";
import { OrderDiscountDialog } from "@/components/pos/order-discount-dialog";
import { HeldOrdersDialog } from "@/components/pos/held-orders-dialog";
import { PaymentDialog } from "@/components/pos/payment-dialog";
import { BarcodeInput } from "@/components/pos/barcode-input";
import { RegisterStatusBar } from "@/components/pos/register-status-bar";
import { SyncStatusBadge } from "@/components/pos/sync-status-badge";
import { Receipt } from "@/components/pos/receipt";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, ShoppingCart, Inbox, Printer } from "lucide-react";

export function PosClient({
  profile,
  register,
  categories,
  products,
  paymentMethods,
  taxSettings,
  businessSettings,
  discountLimit,
}: {
  profile: Profile;
  register: CashRegister;
  categories: Category[];
  products: Product[];
  paymentMethods: PaymentMethod[];
  taxSettings: TaxSettings | null;
  businessSettings: BusinessSettings | null;
  discountLimit: DiscountLimit | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const online = useOnlineStatus();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>(businessSettings?.default_order_type ?? "takeaway");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderDiscount, setOrderDiscount] = useState<OrderDiscount>({ type: null, value: 0 });

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [heldDialogOpen, setHeldDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const maxDiscountPercent = discountLimit?.unlimited ? 100 : discountLimit?.max_percent ?? 0;

  // Debounce the product search so filtering doesn't run on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setHeldOrders(listHeldOrders(profile.id));
  }, [profile.id, heldDialogOpen]);

  // Retry any offline-queued sales on load, when the browser comes back online, and on focus.
  useEffect(() => {
    retryAll(supabase);
    function onOnline() {
      retryAll(supabase).then((r) => {
        if (r.synced > 0) toast.success(`Synced ${r.synced} pending sale${r.synced === 1 ? "" : "s"}.`);
      });
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (activeCategory && p.category_id !== activeCategory) return false;
      if (!search) return true;
      const q = search;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    });
  }, [products, activeCategory, search]);

  function addToCart(product: Product) {
    if (product.track_inventory && product.current_stock <= 0) {
      toast.error(`${product.name} is out of stock.`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id && !i.notes && !i.discountType);
      if (existing) {
        return prev.map((i) => (i.lineId === existing.lineId ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          lineId: generateClientTxnId(),
          productId: product.id,
          productName: product.name,
          unitPrice: product.selling_price,
          quantity: 1,
          notes: "",
          discountType: null,
          discountValue: 0,
          taxEnabled: product.tax_enabled,
          taxRate: product.tax_rate,
        },
      ];
    });
  }

  function handleBarcodeScan(code: string) {
    const product = products.find((p) => p.barcode && p.barcode === code);
    if (!product) {
      toast.error(`Product not found for barcode "${code}".`);
      return;
    }
    addToCart(product);
    toast.success(`Added ${product.name}`);
  }

  useBarcodeScanner(handleBarcodeScan);

  function updateQty(lineId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.lineId !== lineId));
      return;
    }
    setCart((prev) => prev.map((i) => (i.lineId === lineId ? { ...i, quantity: qty } : i)));
  }

  function removeItem(lineId: string) {
    setCart((prev) => prev.filter((i) => i.lineId !== lineId));
  }

  function saveItemEdit(lineId: string, notes: string, discountType: CartItem["discountType"], discountValue: number) {
    setCart((prev) => prev.map((i) => (i.lineId === lineId ? { ...i, notes, discountType, discountValue } : i)));
  }

  function resetOrder() {
    setCart([]);
    setOrderNotes("");
    setOrderDiscount({ type: null, value: 0 });
    setOrderType(businessSettings?.default_order_type ?? "takeaway");
  }

  function handleHold() {
    if (cart.length === 0) return;
    holdOrder(profile.id, { cart, orderType, orderNotes, customerId: null, customerName: null, orderDiscount });
    setHeldOrders(listHeldOrders(profile.id));
    resetOrder();
    toast.success("Order held. Resume it anytime from Held orders.");
  }

  function handleResumeHeld(order: HeldOrder) {
    setCart(order.cart);
    setOrderType(order.orderType);
    setOrderNotes(order.orderNotes);
    setOrderDiscount(order.orderDiscount);
    discardHeldOrder(profile.id, order.id);
    setHeldOrders(listHeldOrders(profile.id));
    setHeldDialogOpen(false);
  }

  function handleDiscardHeld(order: HeldOrder) {
    discardHeldOrder(profile.id, order.id);
    setHeldOrders(listHeldOrders(profile.id));
  }

  const totals = computeCartTotals(cart, orderDiscount, taxSettings);
  const editingItem = cart.find((i) => i.lineId === editingLineId) ?? null;

  async function handleConfirmPayment(payment: { paymentMethodId: string; amountReceived: number | null; changeAmount: number; reference: string | null }) {
    setProcessingPayment(true);
    const clientTxnId = generateClientTxnId();
    const method = paymentMethods.find((m) => m.id === payment.paymentMethodId);

    const payload: CompleteSalePayload = {
      p_client_txn_id: clientTxnId,
      p_order_type: orderType,
      p_customer_id: null,
      p_register_id: register.id,
      p_subtotal: totals.subtotal,
      p_discount_type: orderDiscount.type,
      p_discount_value: orderDiscount.value,
      p_discount_amount: totals.discountAmount,
      p_tax_amount: totals.taxAmount,
      p_total: totals.total,
      p_notes: orderNotes.trim() || null,
      p_items: totals.lines.map((l) => ({
        product_id: l.productId,
        product_name: l.productName,
        unit_price: l.unitPrice,
        quantity: l.quantity,
        item_discount_amount: l.itemDiscountAmount,
        tax_amount: l.taxAmount,
        line_total: l.lineTotal,
        notes: l.notes,
      })),
      p_payments: [
        {
          payment_method_id: payment.paymentMethodId,
          amount: totals.total,
          amount_received: payment.amountReceived,
          change_amount: payment.changeAmount,
          reference: payment.reference,
        },
      ],
    };

    const receiptData: ReceiptData = {
      orderNumber: "Pending",
      createdAt: new Date().toISOString(),
      cashierName: profile.full_name,
      orderType,
      notes: payload.p_notes,
      items: totals.lines.map((l) => ({
        productName: l.productName,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        itemDiscountAmount: l.itemDiscountAmount,
        lineTotal: l.lineTotal,
      })),
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      taxName: taxSettings?.name ?? "Tax",
      total: totals.total,
      payments: [
        {
          methodName: method?.name ?? "Payment",
          amount: totals.total,
          amountReceived: payment.amountReceived,
          changeAmount: payment.changeAmount,
        },
      ],
      syncStatus: "synced",
    };

    async function finish(orderNumber: string | null, syncStatus: "synced" | "pending") {
      setReceipt({ ...receiptData, orderNumber: orderNumber ?? "Pending sync", syncStatus });
      setReceiptOpen(true);
      setPaymentDialogOpen(false);
      resetOrder();
      setProcessingPayment(false);
    }

    if (!online) {
      enqueueSale(payload);
      toast.message("You're offline — sale saved and will sync automatically.");
      await finish(null, "pending");
      return;
    }

    try {
      const { data, error } = await supabase.rpc("complete_sale", payload as unknown as Record<string, unknown>);
      if (error) {
        const isNetworkError = /fetch|network/i.test(error.message);
        if (isNetworkError) {
          enqueueSale(payload);
          toast.message("Connection issue — sale saved and will sync automatically.");
          await finish(null, "pending");
          return;
        }
        toast.error("Unable to complete sale. Please try again.");
        setProcessingPayment(false);
        return;
      }
      await finish((data as { order_number: string } | null)?.order_number ?? null, "synced");
      toast.success("Sale completed.");
    } catch {
      enqueueSale(payload);
      toast.message("Connection issue — sale saved and will sync automatically.");
      await finish(null, "pending");
    }
  }

  usePosKeyboardShortcuts({
    onFocusSearch: () => searchInputRef.current?.focus(),
    onOpenPayment: () => cart.length > 0 && setPaymentDialogOpen(true),
    onHoldOrder: handleHold,
    onOpenDiscount: () => setDiscountDialogOpen(true),
    onEscape: () => {
      if (paymentDialogOpen) setPaymentDialogOpen(false);
      else if (discountDialogOpen) setDiscountDialogOpen(false);
      else if (heldDialogOpen) setHeldDialogOpen(false);
      else if (editingLineId) setEditingLineId(null);
      else if (mobileCartOpen) setMobileCartOpen(false);
    },
  });

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <RegisterStatusBar register={register} cashierName={profile.full_name} />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products by name, SKU… (F2)"
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <SyncStatusBadge />
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setHeldDialogOpen(true)}>
                <Inbox className="h-3.5 w-3.5" />
                Held{heldOrders.length > 0 ? ` (${heldOrders.length})` : ""}
              </Button>
            </div>
          </div>

          <BarcodeInput onScan={handleBarcodeScan} />

          <CategoryTabs categories={categories} activeId={activeCategory} onSelect={setActiveCategory} />

          <div className="pb-24 lg:pb-0">
            <ProductGrid products={filteredProducts} onSelect={addToCart} />
          </div>
        </div>

        {/* Desktop cart, sticky on the right */}
        <div className="hidden w-[380px] shrink-0 border-l bg-card lg:block">
          <CartPanel
            cart={cart}
            totals={totals}
            orderType={orderType}
            dineInEnabled={!!businessSettings?.dine_in_enabled}
            orderNotes={orderNotes}
            onOrderNotesChange={setOrderNotes}
            onOrderTypeChange={setOrderType}
            onQtyChange={updateQty}
            onRemove={removeItem}
            onEditItem={setEditingLineId}
            onOpenDiscount={() => setDiscountDialogOpen(true)}
            onHold={handleHold}
            onNewOrder={resetOrder}
            onPay={() => setPaymentDialogOpen(true)}
          />
        </div>
      </div>

      {/* Mobile bottom bar */}
      <button
        type="button"
        onClick={() => setMobileCartOpen(true)}
        disabled={cart.length === 0}
        className="pos-tap fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 bg-primary px-4 py-3 text-primary-foreground shadow-lg disabled:opacity-60 lg:hidden"
      >
        <span className="flex items-center gap-2 font-medium">
          <ShoppingCart className="h-4 w-4" />
          View cart ({cart.reduce((s, i) => s + i.quantity, 0)})
        </span>
        <span className="font-semibold">{formatMVR(totals.total)}</span>
      </button>

      {/* Mobile cart sheet */}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileCartOpen(false)} />
          <div className="relative max-h-[88dvh] rounded-t-2xl border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b p-3">
              <p className="font-semibold">Cart</p>
              <Button variant="ghost" size="sm" onClick={() => setMobileCartOpen(false)}>
                Close
              </Button>
            </div>
            <CartPanel
              cart={cart}
              totals={totals}
              orderType={orderType}
              dineInEnabled={!!businessSettings?.dine_in_enabled}
              orderNotes={orderNotes}
              onOrderNotesChange={setOrderNotes}
              onOrderTypeChange={setOrderType}
              onQtyChange={updateQty}
              onRemove={removeItem}
              onEditItem={setEditingLineId}
              onOpenDiscount={() => setDiscountDialogOpen(true)}
              onHold={() => {
                handleHold();
                setMobileCartOpen(false);
              }}
              onNewOrder={resetOrder}
              onPay={() => setPaymentDialogOpen(true)}
              className="max-h-[80dvh]"
            />
          </div>
        </div>
      )}

      <CartItemEditDialog
        item={editingItem}
        open={!!editingLineId}
        onOpenChange={(v) => !v && setEditingLineId(null)}
        maxDiscountPercent={maxDiscountPercent}
        onSave={saveItemEdit}
      />

      <OrderDiscountDialog
        open={discountDialogOpen}
        onOpenChange={setDiscountDialogOpen}
        value={orderDiscount}
        maxDiscountPercent={maxDiscountPercent}
        onSave={setOrderDiscount}
      />

      <HeldOrdersDialog
        open={heldDialogOpen}
        onOpenChange={setHeldDialogOpen}
        heldOrders={heldOrders}
        taxSettings={taxSettings}
        onResume={handleResumeHeld}
        onDiscard={handleDiscardHeld}
      />

      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        total={totals.total}
        paymentMethods={paymentMethods}
        processing={processingPayment}
        onConfirm={handleConfirmPayment}
      />

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sale complete</DialogTitle>
          </DialogHeader>
          {receipt && businessSettings && <Receipt data={receipt} business={businessSettings} />}
          <div className="no-print flex gap-2">
            <Button className="flex-1 gap-1.5" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print receipt
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setReceiptOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
