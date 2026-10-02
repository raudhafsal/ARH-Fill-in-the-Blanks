"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatMVR, generateClientTxnId, round2 } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { computeCartTotals } from "@/lib/pos/cart-math";
import { enqueueSale, retryAll } from "@/lib/pos/offline-queue";
import { holdOrder, listHeldOrders, discardHeldOrder } from "@/lib/pos/held-orders";
import { usePosKeyboardShortcuts } from "@/lib/pos/use-keyboard-shortcuts";
import { useBarcodeScanner } from "@/lib/pos/use-barcode-scanner";
import type { CartItem, CompleteSalePayload, HeldOrder, OrderTab, ReceiptData, SellableItem } from "@/lib/pos/types";
import type {
  BusinessSettings,
  CashRegister,
  Category,
  Customer,
  DiscountLimit,
  OrderType,
  PaymentMethod,
  Product,
  ProductUnit,
  Profile,
  TaxSettings,
} from "@/types/database";

import { CategoryTiles, ALL_ITEMS_ID } from "@/components/pos/category-tiles";
import { ProductGrid } from "@/components/pos/product-grid";
import { CartPanel } from "@/components/pos/cart-panel";
import { CartItemEditDialog } from "@/components/pos/cart-item-edit-dialog";
import { OrderDiscountDialog } from "@/components/pos/order-discount-dialog";
import { HeldOrdersDialog } from "@/components/pos/held-orders-dialog";
import { OpenOrdersDialog } from "@/components/pos/open-orders-dialog";
import { PaymentDialog } from "@/components/pos/payment-dialog";
import { BarcodeInput } from "@/components/pos/barcode-input";
import { RegisterStatusBar } from "@/components/pos/register-status-bar";
import { SyncStatusBadge } from "@/components/pos/sync-status-badge";
import { Receipt } from "@/components/pos/receipt";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, ShoppingCart, Inbox, Printer, ArrowLeft } from "lucide-react";

export function PosClient({
  profile,
  register,
  categories,
  products,
  productUnits,
  paymentMethods,
  taxSettings,
  businessSettings,
  discountLimit,
  customers: initialCustomers,
}: {
  profile: Profile;
  register: CashRegister;
  categories: Category[];
  products: Product[];
  productUnits: ProductUnit[];
  paymentMethods: PaymentMethod[];
  taxSettings: TaxSettings | null;
  businessSettings: BusinessSettings | null;
  discountLimit: DiscountLimit | null;
  customers: Customer[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const online = useOnlineStatus();

  const tabCounterRef = useRef(1);
  function createTab(): OrderTab {
    const n = tabCounterRef.current++;
    return {
      id: generateClientTxnId(),
      label: `Order ${n}`,
      openedAt: new Date().toISOString(),
      cart: [],
      orderType: businessSettings?.default_order_type ?? "takeaway",
      orderNotes: "",
      orderDiscount: { type: null, value: 0 },
    };
  }

  const [tabs, setTabs] = useState<OrderTab[]>(() => [createTab()]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const { cart, orderType, orderNotes, orderDiscount } = activeTab;

  function updateTab(tabId: string, updater: (t: OrderTab) => OrderTab) {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? updater(t) : t)));
  }

  function patchActiveTab(patch: Partial<OrderTab>) {
    updateTab(activeTabId, (t) => ({ ...t, ...patch }));
  }

  function updateCart(updater: (cart: CartItem[]) => CartItem[]) {
    updateTab(activeTabId, (t) => ({ ...t, cart: updater(t.cart) }));
  }

  /** Adds a brand-new blank tab and switches to it (the "+" button). */
  function addNewTab() {
    const tab = createTab();
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }

  /** Closes a tab (payment completed, held, or manually discarded). Always leaves at least one tab open. */
  function closeTab(tabId: string) {
    const remaining = tabs.filter((t) => t.id !== tabId);
    if (remaining.length === 0) {
      const fresh = createTab();
      setTabs([fresh]);
      setActiveTabId(fresh.id);
      return;
    }
    setTabs(remaining);
    if (tabId === activeTabId) {
      setActiveTabId(remaining[0].id);
    }
  }

  function handleCloseTab(tabId: string) {
    const target = tabs.find((t) => t.id === tabId);
    closeTab(tabId);
    if (target && target.cart.length > 0) {
      toast.message("Order discarded.");
    }
  }

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [heldDialogOpen, setHeldDialogOpen] = useState(false);
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false);
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
      if (activeCategory && activeCategory !== ALL_ITEMS_ID && p.category_id !== activeCategory) return false;
      if (!search) return true;
      const q = search;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    });
  }, [products, activeCategory, search]);

  // A product with extra units (product_units) gets one POS tile per unit — Ewity-style
  // ("Wafer Chocolate / Single", "Wafer Chocolate / Pkt") — all sharing the same base stock.
  const unitsByProduct = useMemo(() => {
    const m = new Map<string, ProductUnit[]>();
    for (const u of productUnits) {
      const arr = m.get(u.product_id) ?? [];
      arr.push(u);
      m.set(u.product_id, arr);
    }
    return m;
  }, [productUnits]);

  function sellableItemsFor(product: Product): SellableItem[] {
    const units = unitsByProduct.get(product.id) ?? [];
    const base: SellableItem = {
      key: product.id,
      product,
      unitId: null,
      unitName: product.unit,
      unitScale: 1,
      price: product.selling_price,
    };
    if (units.length === 0) return [base];
    return [
      base,
      ...units.map((u) => ({
        key: `${product.id}:${u.id}`,
        product,
        unitId: u.id,
        unitName: u.name,
        unitScale: u.scale,
        price: u.price ?? round2(product.selling_price * u.scale),
      })),
    ];
  }

  const sellableTiles = useMemo(
    () => filteredProducts.flatMap(sellableItemsFor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredProducts, unitsByProduct]
  );

  /** Total base units of this product already sitting in the cart (across all its unit tiles). */
  function baseUnitsInCart(productId: string, excludeLineId?: string): number {
    return cart.reduce(
      (sum, i) => (i.productId === productId && i.lineId !== excludeLineId ? sum + i.quantity * i.unitScale : sum),
      0
    );
  }

  // Tile home screen (Ewity-style): categories as tiles until one is picked, or the cashier searches.
  const showCategoryHome = !activeCategory && !search;
  const activeCategoryName =
    activeCategory === ALL_ITEMS_ID ? "All items" : categories.find((c) => c.id === activeCategory)?.name ?? null;

  function addToCart(item: SellableItem) {
    const { product } = item;
    if (product.track_inventory) {
      const already = baseUnitsInCart(product.id);
      if (already + item.unitScale > product.current_stock) {
        toast.error(`Not enough stock of ${product.name} left.`);
        return;
      }
    }
    updateCart((prev) => {
      const existing = prev.find(
        (i) => i.productId === product.id && i.unitName === item.unitName && i.unitScale === item.unitScale && !i.notes && !i.discountType
      );
      if (existing) {
        return prev.map((i) => (i.lineId === existing.lineId ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          lineId: generateClientTxnId(),
          productId: product.id,
          productName: product.name,
          unitPrice: item.price,
          quantity: 1,
          notes: "",
          discountType: null,
          discountValue: 0,
          taxEnabled: product.tax_enabled,
          taxRate: product.tax_rate,
          unitName: item.unitId ? item.unitName : null,
          unitScale: item.unitScale,
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
    addToCart({ key: product.id, product, unitId: null, unitName: product.unit, unitScale: 1, price: product.selling_price });
    toast.success(`Added ${product.name}`);
  }

  useBarcodeScanner(handleBarcodeScan);

  function updateQty(lineId: string, qty: number) {
    if (qty <= 0) {
      updateCart((prev) => prev.filter((i) => i.lineId !== lineId));
      return;
    }
    const line = cart.find((i) => i.lineId === lineId);
    if (line) {
      const product = products.find((p) => p.id === line.productId);
      if (product?.track_inventory) {
        const others = baseUnitsInCart(product.id, lineId);
        if (others + qty * line.unitScale > product.current_stock) {
          toast.error(`Not enough stock of ${product.name} for that quantity.`);
          return;
        }
      }
    }
    updateCart((prev) => prev.map((i) => (i.lineId === lineId ? { ...i, quantity: qty } : i)));
  }

  function removeItem(lineId: string) {
    updateCart((prev) => prev.filter((i) => i.lineId !== lineId));
  }

  function saveItemEdit(lineId: string, notes: string, discountType: CartItem["discountType"], discountValue: number) {
    updateCart((prev) => prev.map((i) => (i.lineId === lineId ? { ...i, notes, discountType, discountValue } : i)));
  }

  function handleHold() {
    if (activeTab.cart.length === 0) return;
    holdOrder(profile.id, {
      cart: activeTab.cart,
      orderType: activeTab.orderType,
      orderNotes: activeTab.orderNotes,
      customerId: null,
      customerName: null,
      orderDiscount: activeTab.orderDiscount,
    });
    setHeldOrders(listHeldOrders(profile.id));
    closeTab(activeTab.id);
    toast.success("Order held. Resume it anytime from Held orders.");
  }

  function handleResumeHeld(order: HeldOrder) {
    const resumed: Partial<OrderTab> = {
      cart: order.cart,
      orderType: order.orderType,
      orderNotes: order.orderNotes,
      orderDiscount: order.orderDiscount,
    };
    if (activeTab.cart.length === 0) {
      updateTab(activeTab.id, (t) => ({ ...t, ...resumed }));
    } else {
      const tab: OrderTab = { ...createTab(), ...resumed };
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(tab.id);
    }
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

  async function handleConfirmPayment(payment: {
    paymentMethodId: string;
    amountReceived: number | null;
    changeAmount: number;
    reference: string | null;
    customerId: string | null;
  }) {
    setProcessingPayment(true);
    const tabId = activeTab.id;
    const clientTxnId = generateClientTxnId();
    const method = paymentMethods.find((m) => m.id === payment.paymentMethodId);
    const customer = payment.customerId ? customers.find((c) => c.id === payment.customerId) ?? null : null;

    const payload: CompleteSalePayload = {
      p_client_txn_id: clientTxnId,
      p_order_type: orderType,
      p_customer_id: payment.customerId,
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
        unit_name: l.unitName,
        unit_scale: l.unitScale,
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
      customerName: customer?.full_name ?? null,
      notes: payload.p_notes,
      items: totals.lines.map((l) => ({
        productName: l.productName,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        itemDiscountAmount: l.itemDiscountAmount,
        lineTotal: l.lineTotal,
        unitName: l.unitName,
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
      closeTab(tabId);
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
      else if (ordersDialogOpen) setOrdersDialogOpen(false);
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

          <div className="pb-24 lg:pb-0">
            {showCategoryHome ? (
              <CategoryTiles categories={categories} onSelect={setActiveCategory} />
            ) : (
              <div className="flex flex-col gap-3">
                {activeCategory && (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setActiveCategory(null)}>
                      <ArrowLeft className="h-3.5 w-3.5" /> Categories
                    </Button>
                    {activeCategoryName && <span className="text-sm font-medium">{activeCategoryName}</span>}
                  </div>
                )}
                <ProductGrid items={sellableTiles} onSelect={addToCart} />
              </div>
            )}
          </div>
        </div>

        {/* Desktop cart, sticky on the right */}
        <div className="hidden w-[380px] shrink-0 border-l bg-card lg:block">
          <CartPanel
            activeLabel={activeTab.label}
            openOrderCount={tabs.length}
            onOpenOrders={() => setOrdersDialogOpen(true)}
            cart={cart}
            totals={totals}
            orderType={orderType}
            dineInEnabled={!!businessSettings?.dine_in_enabled}
            orderNotes={orderNotes}
            onOrderNotesChange={(v) => patchActiveTab({ orderNotes: v })}
            onOrderTypeChange={(v) => patchActiveTab({ orderType: v })}
            onQtyChange={updateQty}
            onRemove={removeItem}
            onEditItem={setEditingLineId}
            onOpenDiscount={() => setDiscountDialogOpen(true)}
            onHold={handleHold}
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
              activeLabel={activeTab.label}
              openOrderCount={tabs.length}
              onOpenOrders={() => setOrdersDialogOpen(true)}
              cart={cart}
              totals={totals}
              orderType={orderType}
              dineInEnabled={!!businessSettings?.dine_in_enabled}
              orderNotes={orderNotes}
              onOrderNotesChange={(v) => patchActiveTab({ orderNotes: v })}
              onOrderTypeChange={(v) => patchActiveTab({ orderType: v })}
              onQtyChange={updateQty}
              onRemove={removeItem}
              onEditItem={setEditingLineId}
              onOpenDiscount={() => setDiscountDialogOpen(true)}
              onHold={() => {
                handleHold();
                setMobileCartOpen(false);
              }}
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
        onSave={(d) => patchActiveTab({ orderDiscount: d })}
      />

      <HeldOrdersDialog
        open={heldDialogOpen}
        onOpenChange={setHeldDialogOpen}
        heldOrders={heldOrders}
        taxSettings={taxSettings}
        onResume={handleResumeHeld}
        onDiscard={handleDiscardHeld}
      />

      <OpenOrdersDialog
        open={ordersDialogOpen}
        onOpenChange={setOrdersDialogOpen}
        tabs={tabs}
        activeTabId={activeTabId}
        taxSettings={taxSettings}
        onSelect={setActiveTabId}
        onClose={handleCloseTab}
        onAddNew={addNewTab}
      />

      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        total={totals.total}
        paymentMethods={paymentMethods}
        customers={customers}
        onCustomerCreated={(c) => setCustomers((prev) => [...prev, c].sort((a, b) => a.full_name.localeCompare(b.full_name)))}
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
