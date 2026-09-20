"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompleteSalePayload } from "./types";

/**
 * Offline-safe sale queue, backed by localStorage. `complete_sale` is
 * idempotent on `client_txn_id` (a unique DB column checked first), so a
 * queued sale can be retried any number of times without double-charging.
 */

const STORAGE_KEY = "arh_pos_pending_sales_v1";
const CHANGE_EVENT = "arh-pos-queue-changed";

export type QueuedSaleStatus = "pending" | "failed";

export interface QueuedSale {
  clientTxnId: string;
  payload: CompleteSalePayload;
  status: QueuedSaleStatus;
  createdAt: string;
  lastAttemptAt: string | null;
  lastError: string | null;
  attempts: number;
}

function readAll(): QueuedSale[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(sales: QueuedSale[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sales));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // Storage full or unavailable — nothing more we can do client-side.
  }
}

/** Subscribe to any change in the pending-sale queue (used to drive a sync-status badge). */
export function onQueueChange(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function enqueueSale(payload: CompleteSalePayload): QueuedSale {
  const sales = readAll();
  const entry: QueuedSale = {
    clientTxnId: payload.p_client_txn_id,
    payload,
    status: "pending",
    createdAt: new Date().toISOString(),
    lastAttemptAt: null,
    lastError: null,
    attempts: 0,
  };
  sales.push(entry);
  writeAll(sales);
  return entry;
}

export function listPending(): QueuedSale[] {
  return readAll();
}

export function markSynced(clientTxnId: string) {
  const sales = readAll().filter((s) => s.clientTxnId !== clientTxnId);
  writeAll(sales);
}

function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /fetch|network|failed to fetch|offline|NetworkError/i.test(msg);
}

/**
 * Retries every queued sale against the `complete_sale` RPC. Safe to call
 * repeatedly (on an interval, on `online`, on focus) — synced rows are
 * removed, still-offline rows are left untouched, and genuine server
 * rejections are marked "failed" for a human to look at rather than retried
 * forever.
 */
export async function retryAll(supabase: SupabaseClient): Promise<{ synced: number; failed: number; stillPending: number }> {
  const sales = readAll();
  const remaining: QueuedSale[] = [];
  let synced = 0;
  let failed = 0;

  for (const sale of sales) {
    try {
      const { error } = await supabase.rpc("complete_sale", sale.payload as unknown as Record<string, unknown>);
      if (error) {
        if (isNetworkError(error)) {
          remaining.push(sale); // still offline, leave pending as-is
          continue;
        }
        remaining.push({
          ...sale,
          status: "failed",
          lastError: error.message,
          attempts: sale.attempts + 1,
          lastAttemptAt: new Date().toISOString(),
        });
        failed += 1;
        continue;
      }
      synced += 1; // do not push — this sale is now synced and drops out of the queue
    } catch (err) {
      if (isNetworkError(err)) {
        remaining.push(sale);
      } else {
        remaining.push({
          ...sale,
          status: "failed",
          lastError: err instanceof Error ? err.message : "Unknown error",
          attempts: sale.attempts + 1,
          lastAttemptAt: new Date().toISOString(),
        });
        failed += 1;
      }
    }
  }

  writeAll(remaining);
  return { synced, failed, stillPending: remaining.filter((s) => s.status === "pending").length };
}
