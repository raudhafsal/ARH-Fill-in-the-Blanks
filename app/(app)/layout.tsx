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
  return <AppShell profile={profile}>{children}</AppShell>;
}
