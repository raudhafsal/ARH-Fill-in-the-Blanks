import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/components/app-shell/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // TEMPORARY DIAGNOSTIC: surface the real error instead of the generic
  // "server-side exception" page while we track down the /dashboard crash.
  // Safe to remove once the underlying bug is found and fixed.
  let profile;
  try {
    profile = await requireProfile();
  } catch (err: any) {
    if (err?.digest === "NEXT_REDIRECT" || String(err?.digest ?? "").startsWith("NEXT_REDIRECT")) {
      throw err; // let real redirects (e.g. to /login) proceed normally
    }
    return (
      <pre style={{ whiteSpace: "pre-wrap", padding: 24, fontSize: 12, color: "#b91c1c", background: "#fff", minHeight: "100vh" }}>
        {"DIAGNOSTIC — AppLayout requireProfile() threw:\n\n"}
        {"name: " + (err?.name ?? typeof err) + "\n"}
        {"message: " + (err?.message ?? String(err)) + "\n"}
        {"code: " + (err?.code ?? "n/a") + "\n"}
        {"status: " + (err?.status ?? "n/a") + "\n"}
        {"stack:\n" + (err?.stack ?? "n/a")}
      </pre>
    );
  }
  // TEMPORARY DIAGNOSTIC: bypass all chrome (Sidebar/Header/MobileNav) entirely to
  // determine whether the crash is really in AppShell or somewhere else. If this
  // renders successfully, the bug is in AppShell's tree; if it still crashes, it's
  // somewhere we haven't found yet (middleware, a shared lib, etc).
  return (
    <div style={{ padding: 24 }}>
      <p style={{ fontSize: 12, color: "#16a34a", marginBottom: 16 }}>
        DIAGNOSTIC — bare layout, AppShell bypassed. If you see this and the content below it, AppShell (Sidebar/Header/MobileNav) is the problem.
      </p>
      {children}
    </div>
  );
}
