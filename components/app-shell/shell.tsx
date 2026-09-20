import type { Profile } from "@/types/database";
import { navForRole } from "@/lib/nav-config";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import { DebugBoundary } from "./debug-boundary";

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const items = navForRole(profile.role);

  // TEMPORARY DIAGNOSTIC: Sidebar, Header, and MobileNav all removed — only the
  // navForRole(items) computation is kept. If this still crashes, the bug is in
  // navForRole/nav-config (e.g. a bad icon import), not in Sidebar/Header/MobileNav
  // themselves.
  return (
    <div className="flex min-h-screen">
      <div className="flex min-w-0 flex-1 flex-col">
        <p style={{ fontSize: 12, color: "#16a34a", padding: 8 }}>
          DIAGNOSTIC — Sidebar/Header/MobileNav all removed. items.length = {items.length}
        </p>
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
    </div>
  );
}
