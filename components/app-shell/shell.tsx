"use client";

import type { Profile } from "@/types/database";
import { navForRole } from "@/lib/nav-config";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import { ShellErrorBoundary } from "./error-boundary";

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const items = navForRole(profile.role);

  return (
    <div className="flex min-h-screen">
      <ShellErrorBoundary label="Sidebar">
        <Sidebar items={items} />
      </ShellErrorBoundary>
      <div className="flex min-w-0 flex-1 flex-col">
        <ShellErrorBoundary label="Header">
          <Header profile={profile} />
        </ShellErrorBoundary>
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <ShellErrorBoundary label="MobileNav">
        <MobileNav items={items} />
      </ShellErrorBoundary>
    </div>
  );
}
