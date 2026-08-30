import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AccountGate = {
  userId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
};

/** Requires a signed-in, email-verified account with a fresh login confirmation. */
export async function requireVerifiedAccount(
  userId: string,
  claims: Record<string, unknown>,
): Promise<AccountGate> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name, email_verified, mfa_ok_until")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) throw new Error("Your profile is not set up yet. Sign in again.");
  if (!profile.email_verified) throw new Error("Verify your email address to use this feature.");
  const mfaOk = profile.mfa_ok_until ? new Date(profile.mfa_ok_until).getTime() > Date.now() : false;
  if (!mfaOk) throw new Error("Confirm this sign-in with the code we emailed you.");

  const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);

  return {
    userId,
    email: profile.email || String(claims["email"] ?? ""),
    displayName: profile.display_name,
    isAdmin: (roles ?? []).some((r) => r.role === "admin"),
  };
}

export async function requireAdmin(
  userId: string,
  claims: Record<string, unknown>,
): Promise<AccountGate> {
  const account = await requireVerifiedAccount(userId, claims);
  if (!account.isAdmin) throw new Error("Forbidden");
  return account;
}

export async function writeAudit(entry: {
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  priorValue?: unknown;
  newValue?: unknown;
  reason: string;
}): Promise<void> {
  await supabaseAdmin.from("admin_audit_log").insert({
    actor_id: entry.actorId,
    actor_email: entry.actorEmail,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId,
    prior_value: (entry.priorValue ?? null) as never,
    new_value: (entry.newValue ?? null) as never,
    reason: entry.reason,
  });
}
