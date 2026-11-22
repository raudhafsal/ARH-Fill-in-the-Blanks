import { createClient } from "@/lib/supabase/client";

/** Public Web Push (VAPID) key — safe to ship in the client. The private key lives in the database vault. */
export const VAPID_PUBLIC_KEY = "BCBRhIzVnQLJWw0Ks6PIK872KPCCuvxaV8lCJHgWr7omoomq9oaz7OaYOUl0vQpYcRIoXAnyNi0fzf_sJFQlC4Q";

export type PushState = "unsupported" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

const PUSH_SW_URL = "/push-sw/sw.js";
const PUSH_SW_SCOPE = "/push-sw/";

/** A small dedicated service worker just for push, registered on its own scope so it can't clash with the offline cache worker. */
async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register(PUSH_SW_URL, { scope: PUSH_SW_SCOPE });
  if (reg.active) return reg;
  const worker = reg.installing ?? reg.waiting;
  if (!worker) throw new Error("The push service worker didn't start.");
  await withTimeout(
    new Promise<void>((resolve, reject) => {
      const check = () => {
        if (worker.state === "activated") resolve();
        else if (worker.state === "redundant") reject(new Error("The push service worker failed to install."));
      };
      worker.addEventListener("statechange", check);
      check();
    }),
    10000,
    "The push service worker took too long to start. Refresh the page and try again."
  );
  return reg;
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration(PUSH_SW_SCOPE);
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "off";
  }
}

export async function enablePush(userId: string): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const reg = await getRegistration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }));
  const json = sub.toJSON();
  const supabase = createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration(PUSH_SW_SCOPE);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const supabase = createClient();
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
  return "off";
}
