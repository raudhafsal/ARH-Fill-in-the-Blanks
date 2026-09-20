"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/nav-config";

export function Sidebar({ items }: { items: NavItem[] }) {
  // TEMPORARY DIAGNOSTIC: the previous null-guard on usePathname() didn't fix the
  // crash, so wrap literally everything (including the hook call itself) in a
  // try/catch to find out whether it's throwing outright, and print exactly what.
  try {
    const pathname = usePathname() ?? "";

    return (
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            ARH
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">ARH Fill in the Blank</p>
            <p className="text-xs text-muted-foreground">Point of Sale</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    );
  } catch (err: any) {
    return (
      <pre
        style={{
          whiteSpace: "pre-wrap",
          padding: 16,
          margin: 8,
          fontSize: 12,
          color: "#b91c1c",
          background: "#fef2f2",
          border: "2px solid #b91c1c",
          maxWidth: 500,
        }}
      >
        {"DIAGNOSTIC — Sidebar threw:\n\n"}
        {"name: " + (err?.name ?? typeof err) + "\n"}
        {"message: " + (err?.message ?? String(err)) + "\n"}
        {"stack:\n" + (err?.stack ?? "n/a")}
      </pre>
    );
  }
}
