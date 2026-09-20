import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import { redirect } from "next/navigation";

/** Server-side: get the signed-in user's profile (role, name, etc). Redirects to /login if not signed in. */
export async function requireProfile(): Promise<Profile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (!profile) redirect("/login");
  return profile as Profile;
}

/** Server-side: require one of the given roles, otherwise redirect to /dashboard (frontend gate only — RLS is the real enforcement). */
export async function requireRole(roles: Array<Profile["role"]>): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) {
    redirect("/dashboard?error=forbidden");
  }
  return profile;
}
