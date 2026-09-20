import type { Profile } from "@/types/database";
import { navForRole } from "@/lib/nav-config";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import { DebugBoundary } from "./debug-boundary";

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const items = navForRole(profile.role);

  // TEMPORARY DIAGNOSTIC: Header and MobileNav still removed. Sidebar added back
  // in to test it alone — Header removal alone didn't fix the crash, but removing
  // Sidebar+MobileNav together did, so it's one of those two.
  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} />
      <div className="flex min-w-0 flex-1 flex-col">
        <p style={{ fontSize: 12, color: "#16a34a", padding: 8 }}>DIAGNOSTIC — Header/MobileNav removed, Sidebar restored.</p>
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
    </div>
  );
}
