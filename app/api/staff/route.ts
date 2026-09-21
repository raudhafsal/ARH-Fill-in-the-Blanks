import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const createStaffSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(150),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
  role: z.enum(["administrator", "manager", "cashier"]),
  phone: z.string().trim().max(30).optional(),
  max_discount_percent: z.coerce.number().min(0).max(100).optional(),
});

/** Admin-only: create a new staff login (auth user) + profile in one step. */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!callerProfile || callerProfile.role !== "administrator") {
    return NextResponse.json({ error: "Only administrators can add staff." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { full_name, email, password, role, phone, max_discount_percent } = parsed.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      {
        error:
          "Adding staff from the app isn't set up yet — SUPABASE_SERVICE_ROLE_KEY is missing from this deployment's environment variables.",
      },
      { status: 500 }
    );
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });

  if (createError || !created.user) {
    const message = createError?.message?.toLowerCase().includes("already been registered")
      ? "A staff account with this email already exists."
      : createError?.message ?? "Unable to create staff account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // The on_auth_user_created trigger already inserted the profile row from
  // user_metadata (full_name, role). Apply any extra fields on top of that.
  const patch: Record<string, unknown> = {};
  if (phone) patch.phone = phone;
  if (max_discount_percent !== undefined) patch.max_discount_percent = max_discount_percent;
  if (Object.keys(patch).length > 0) {
    await admin.from("profiles").update(patch).eq("id", created.user.id);
  }

  const { data: newProfile } = await admin.from("profiles").select("*").eq("id", created.user.id).single();

  return NextResponse.json({ profile: newProfile });
}
