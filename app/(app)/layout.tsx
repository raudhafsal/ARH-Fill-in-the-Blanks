import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/components/app-shell/shell";
import { ShellErrorBoundary } from "@/components/app-shell/error-boundary";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <ShellErrorBoundary label="AppShell">
      <AppShell profile={profile}>{children}</AppShell>
    </ShellErrorBoundary>
  );
}
