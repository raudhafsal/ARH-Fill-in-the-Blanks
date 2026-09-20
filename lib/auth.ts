import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import { redirect } from "next/navigation";

/**
 * Server-side: get the signed-in user's profile (role, name, etc). Redirects to /login if not signed in.
 *
 * Wrapped in React's `cache()` so it only runs ONCE per request no matter how many Server
 * Components call it (e.g. both `app/(app)/layout.tsx` and a page under it). Without this,
 * the layout and the page each independently call `supabase.auth.getUser()` in parallel; when
 * the access token is near expiry, Supabase's rotating refresh token can only be redeemed once,
 * so one of the two concurrent calls wins the refresh and the other throws an uncaught
 * "Invalid Refresh Token" error — which is what was causing the "server-side exception" on
 * /dashboard (the page's own call succeeded while the layout's parallel call failed).
 */
export const requireProfile = cache(async (): Promise<Profile> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (!profile) redirect("/login");
  return profile as Profile;
});

/** Server-side: require one of the given roles, otherwise redirect to /dashboard (frontend gate only — RLS is the real enforcement). */
export async function requireRole(roles: Array<Profile["role"]>): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) {
    redirect("/dashboard?error=forbidden");
  }
  return profile;
}
