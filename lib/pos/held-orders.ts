"use client";

import type { HeldOrder } from "./types";

/** Held (pre-payment) orders live only in the cashier's browser — never sent to Supabase. */

function storageKey(cashierId: string): string {
  return `arh_pos_held_orders_${cashierId}`;
}

function readAll(cashierId: string): HeldOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(cashierId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(cashierId: string, orders: HeldOrder[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(cashierId), JSON.stringify(orders));
  } catch {
    // ignore quota errors
  }
}

export function holdOrder(cashierId: string, order: Omit<HeldOrder, "id" | "heldAt">): HeldOrder {
  const orders = readAll(cashierId);
  const entry: HeldOrder = {
    ...order,
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
    heldAt: new Date().toISOString(),
  };
  orders.push(entry);
  writeAll(cashierId, orders);
  return entry;
}

export function listHeldOrders(cashierId: string): HeldOrder[] {
  return readAll(cashierId).sort((a, b) => (a.heldAt < b.heldAt ? 1 : -1));
}

export function discardHeldOrder(cashierId: string, id: string) {
  writeAll(cashierId, readAll(cashierId).filter((o) => o.id !== id));
}
