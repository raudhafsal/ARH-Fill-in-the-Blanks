"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, BellRing, BellOff, Ban, RotateCcw, PackageX, CreditCard, Wallet, CheckCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { formatMaldivesDateTime } from "@/lib/utils";
import { enablePush, disablePush, getPushState, type PushState } from "@/lib/push";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read_by: string[] | null;
  created_at: string;
}

const ICONS: Record<string, typeof Bell> = {
  void: Ban,
  void_request: ShieldAlert,
  refund: RotateCcw,
  low_stock: PackageX,
  credit_limit: CreditCard,
  cash_difference: Wallet,
};

export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [pushState, setPushState] = useState<PushState>("off");
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let state = await getPushState();
      // Permission already granted but this device isn't subscribed (or its row is missing): finish the setup quietly.
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && state !== "unsupported") {
        try {
          state = await enablePush(userId);
        } catch {
          /* leave the button so it can be retried */
        }
      }
      if (!cancelled) setPushState(state);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function togglePush() {
    setPushBusy(true);
    try {
      const next = pushState === "on" ? await disablePush() : await enablePush(userId);
      setPushState(next);
      if (next === "on") toast.success("Push notifications are on for this device.");
      else if (next === "denied") toast.error("Notifications are blocked. Allow them in your browser or phone settings.");
    } catch (e) {
      toast.error(`Couldn't change push notifications: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setPushBusy(false);
    }
  }

  const isUnread = useCallback((n: NotificationRow) => !(n.read_by ?? []).includes(userId), [userId]);

  useEffect(() => {
    let active = true;
    supabase
      .from("notifications")
      .select("id,type,title,message,link,read_by,created_at")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (active && data) setItems(data as NotificationRow[]);
      });

    const channel = supabase
      .channel("notifications-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        const n = payload.new as NotificationRow;
        setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev].slice(0, 30)));
        toast(n.title, { description: n.message });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  async function markRead(ids: string[] | null) {
    setItems((prev) =>
      prev.map((n) => (ids === null || ids.includes(n.id) ? { ...n, read_by: [...(n.read_by ?? []), userId] } : n))
    );
    await supabase.rpc("mark_notifications_read", { p_ids: ids });
  }

  const unread = items.filter(isUnread).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] max-w-[92vw] p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm">Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={() => markRead(null)}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-[26rem] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            items.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              const unreadItem = isUnread(n);
              return (
                <DropdownMenuItem
                  key={n.id}
                  className="flex cursor-pointer items-start gap-3 rounded-none px-3 py-2.5"
                  onSelect={() => {
                    if (unreadItem) markRead([n.id]);
                    if (n.link) router.push(n.link);
                  }}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className={unreadItem ? "text-sm font-semibold" : "text-sm font-medium"}>{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatMaldivesDateTime(n.created_at)}</p>
                  </div>
                  {unreadItem && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </DropdownMenuItem>
              );
            })
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="px-3 py-2">
          {pushState === "unsupported" ? (
            <p className="text-xs text-muted-foreground">
              Push alerts aren&apos;t available here. On iPhone, add the POS to your Home Screen first, then open it from there.
            </p>
          ) : pushState === "denied" ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BellOff className="h-3.5 w-3.5" /> Notifications are blocked for this site. Allow them in your browser or phone settings.
            </p>
          ) : (
            <button
              type="button"
              disabled={pushBusy}
              onClick={togglePush}
              className="flex w-full items-center gap-2 text-left text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              {pushState === "on" ? <BellOff className="h-3.5 w-3.5" /> : <BellRing className="h-3.5 w-3.5" />}
              {pushState === "on" ? "Turn off push alerts on this device" : "Turn on push alerts on this device"}
            </button>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
