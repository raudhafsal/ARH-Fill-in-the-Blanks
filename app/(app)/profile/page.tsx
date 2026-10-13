import { requireProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";
import { SignatureCard } from "@/components/profile/signature-card";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const profile = await requireProfile();
  const { data: sig } = await createClient().from("user_signatures").select("image_data").eq("user_id", profile.id).maybeSingle();

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">My profile</h1>
        <p className="text-sm text-muted-foreground">Update your name and contact details.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>{profile.email} · Role: {profile.role}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>
      <SignatureCard userId={profile.id} initialSignature={sig?.image_data ?? null} />
    </div>
  );
}
