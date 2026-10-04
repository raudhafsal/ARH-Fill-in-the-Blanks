"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/nav-config";
import { ChevronDown } from "lucide-react";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function NavGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const children = item.children ?? [];
  const childActive = children.some((c) => isActive(pathname, c.href));
  const [open, setOpen] = useState(true);
  const Icon = item.icon;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          childActive ? "text-foreground" : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-1 border-l pl-2">
          {children.map((c) => {
            const active = isActive(pathname, c.href);
            const CIcon = c.icon;
            return (
              <Link
                key={c.href}
                href={c.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <CIcon className="h-4 w-4" />
                {c.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "";

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-16 items-center gap-2 border-b px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-mark.png" alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
        <div className="leading-tight">
          <p className="text-sm font-semibold">ARH Fill in the Blank</p>
          <p className="text-xs text-muted-foreground">Point of Sale</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          if (item.children) return <NavGroup key={item.href} item={item} pathname={pathname} />;
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
}
