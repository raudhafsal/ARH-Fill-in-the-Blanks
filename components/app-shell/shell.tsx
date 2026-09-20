import type { Profile } from "@/types/database";
import { navForRole } from "@/lib/nav-config";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import { DebugBoundary } from "./debug-boundary";

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const items = navForRole(profile.role);

  return (
    <div className="flex min-h-screen">
      <DebugBoundary label="Sidebar">
        <Sidebar items={items} />
      </DebugBoundary>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* TEMPORARY DIAGNOSTIC: Header removed to bisect which piece of the
            chrome is crashing. Sidebar + MobileNav still render below. */}
        <p style={{ fontSize: 12, color: "#16a34a", padding: 8 }}>DIAGNOSTIC — Header removed.</p>
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <DebugBoundary label="MobileNav">
        <MobileNav items={items} />
      </DebugBoundary>
    </div>
  );
}
