import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MFA_WINDOW_HOURS = 12;

export type SessionState = {
  userId: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  mfaOk: boolean;
  isAdmin: boolean;
};

/** Creates the profile row on first sight and returns the current account state. */
export const getSessionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessionState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = String(context.claims["email"] ?? "").toLowerCase();
    const userId = context.userId;

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    let profile = existing;
    if (!profile) {
      const { data: created } = await supabaseAdmin
        .from("profiles")
        .insert({ id: userId, email, display_name: email.split("@")[0] ?? "member" })
        .select("*")
        .single();
      profile = created;
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "user" });
    }

    const { data: allowlisted } = await supabaseAdmin
      .from("admin_allowlist")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    if (allowlisted) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    }

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const mfaOkUntil = profile?.mfa_ok_until ? new Date(profile.mfa_ok_until).getTime() : 0;

    return {
      userId,
      email,
      displayName: profile?.display_name ?? "",
      emailVerified: profile?.email_verified ?? false,
      mfaOk: mfaOkUntil > Date.now(),
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
    };
  });

export const updateDisplayName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { displayName: string }) =>
    z.object({ displayName: z.string().trim().min(2).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ display_name: data.displayName })
      .eq("id", context.userId);
    if (error) throw new Error("Could not update your display name.");
    return { ok: true };
  });

/** Emails a fresh 6-digit code for signup verification or login confirmation. */
export const requestEmailCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { purpose: "signup" | "login" }) =>
    z.object({ purpose: z.enum(["signup", "login"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sha256, randomCode } = await import("./server-shared.server");
    const { sendVerificationCode } = await import("./emails.server");

    const email = String(context.claims["email"] ?? "").toLowerCase();
    if (!email) throw new Error("No email address on this account.");

    // Abuse protection: max 5 codes per address per hour.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("email_codes")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", since);
    if ((count ?? 0) >= 5) {
      return { sent: false, reason: "rate_limited" as const };
    }

    const code = randomCode(6);
    await supabaseAdmin.from("email_codes").insert({
      user_id: context.userId,
      email,
      purpose: data.purpose,
      code_hash: await sha256(code),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    const sent = await sendVerificationCode(email, code, data.purpose);
    return { sent, reason: sent ? ("ok" as const) : ("smtp_unavailable" as const) };
  });

/** Checks a 6-digit code and unlocks the account / confirms the sign-in. */
export const verifyEmailCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { purpose: "signup" | "login"; code: string }) =>
    z
      .object({ purpose: z.enum(["signup", "login"]), code: z.string().trim().regex(/^\d{6}$/) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sha256 } = await import("./server-shared.server");

    const email = String(context.claims["email"] ?? "").toLowerCase();
    const { data: row } = await supabaseAdmin
      .from("email_codes")
      .select("*")
      .eq("email", email)
      .eq("purpose", data.purpose)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return { ok: false, error: "No pending code. Request a new one." };
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false, error: "That code expired. Request a new one." };
    }
    if (row.attempts >= 5) {
      return { ok: false, error: "Too many attempts. Request a new code." };
    }

    if ((await sha256(data.code)) !== row.code_hash) {
      await supabaseAdmin
        .from("email_codes")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      return { ok: false, error: "That code is not correct." };
    }

    await supabaseAdmin
      .from("email_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);

    const patch = {
      mfa_ok_until: new Date(Date.now() + MFA_WINDOW_HOURS * 60 * 60 * 1000).toISOString(),
      last_login_at: new Date().toISOString(),
      ...(data.purpose === "signup" ? { email_verified: true } : {}),
    };

    await supabaseAdmin.from("profiles").update(patch).eq("id", context.userId);
    return { ok: true };
  });
