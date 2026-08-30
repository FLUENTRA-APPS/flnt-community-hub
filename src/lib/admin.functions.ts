import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
};

export type AdminBusiness = {
  id: string;
  slug: string;
  sellerName: string;
  organicCount: number;
  organicAvg: number;
  adjustCount: number;
  totalCount: number;
  totalAvg: number;
  verified: boolean;
  badgeOverride: boolean | null;
};

export type AuditEntry = {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  createdAt: string;
};

export type AdminTicket = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  userEmail: string;
};

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ users: AdminUser[]; businesses: AdminBusiness[]; audit: AuditEntry[] }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { requireAdmin } = await import("./guards.server");
      await requireAdmin(context.userId, context.claims);

      const [{ data: profiles }, { data: roles }, { data: businesses }, { data: audit }] =
        await Promise.all([
          supabaseAdmin
            .from("profiles")
            .select("id, email, display_name, email_verified, created_at")
            .order("created_at", { ascending: false })
            .limit(300),
          supabaseAdmin.from("user_roles").select("user_id, role"),
          supabaseAdmin
            .from("business_stats")
            .select(
              "id, slug, seller_name, organic_count, organic_avg, adjust_count, total_count, total_avg, verified, badge_override",
            )
            .order("total_count", { ascending: false })
            .limit(200),
          supabaseAdmin
            .from("admin_audit_log")
            .select("id, actor_email, action, target_type, target_id, reason, created_at")
            .order("created_at", { ascending: false })
            .limit(100),
        ]);

      const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));

      return {
        users: (profiles ?? []).map((p) => ({
          id: p.id,
          email: p.email,
          displayName: p.display_name,
          emailVerified: p.email_verified,
          isAdmin: adminIds.has(p.id),
          createdAt: p.created_at,
        })),
        businesses: ((businesses ?? []) as never[]).map((b: Record<string, unknown>) => ({
          id: String(b["id"]),
          slug: String(b["slug"]),
          sellerName: String(b["seller_name"]),
          organicCount: Number(b["organic_count"]),
          organicAvg: Number(b["organic_avg"] ?? 0),
          adjustCount: Number(b["adjust_count"]),
          totalCount: Number(b["total_count"]),
          totalAvg: Number(b["total_avg"] ?? 0),
          verified: Boolean(b["verified"]),
          badgeOverride: (b["badge_override"] ?? null) as boolean | null,
        })),
        audit: (audit ?? []).map((a) => ({
          id: a.id,
          actorEmail: a.actor_email,
          action: a.action,
          targetType: a.target_type,
          targetId: a.target_id,
          reason: a.reason,
          createdAt: a.created_at,
        })),
      };
    },
  );

export const setUserVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; verified: boolean; reason: string }) =>
    z
      .object({
        userId: z.string().uuid(),
        verified: z.boolean(),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin, writeAudit } = await import("./guards.server");
    const actor = await requireAdmin(context.userId, context.claims);

    const { data: prior } = await supabaseAdmin
      .from("profiles")
      .select("email_verified")
      .eq("id", data.userId)
      .maybeSingle();

    await supabaseAdmin
      .from("profiles")
      .update({ email_verified: data.verified })
      .eq("id", data.userId);

    await writeAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "user.verification",
      targetType: "user",
      targetId: data.userId,
      priorValue: { emailVerified: prior?.email_verified ?? null },
      newValue: { emailVerified: data.verified },
      reason: data.reason,
    });
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; makeAdmin: boolean; reason: string }) =>
    z
      .object({
        userId: z.string().uuid(),
        makeAdmin: z.boolean(),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin, writeAudit } = await import("./guards.server");
    const actor = await requireAdmin(context.userId, context.claims);
    if (data.userId === actor.userId && !data.makeAdmin) {
      throw new Error("You cannot remove your own admin role.");
    }

    if (data.makeAdmin) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
    }

    await writeAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "user.role",
      targetType: "user",
      targetId: data.userId,
      priorValue: { admin: !data.makeAdmin },
      newValue: { admin: data.makeAdmin },
      reason: data.reason,
    });
    return { ok: true };
  });

export const setBadgeOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { businessId: string; value: boolean | null; reason: string }) =>
    z
      .object({
        businessId: z.string().uuid(),
        value: z.boolean().nullable(),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin, writeAudit } = await import("./guards.server");
    const actor = await requireAdmin(context.userId, context.claims);

    const { data: prior } = await supabaseAdmin
      .from("businesses")
      .select("badge_override")
      .eq("id", data.businessId)
      .maybeSingle();

    await supabaseAdmin
      .from("businesses")
      .update({ badge_override: data.value })
      .eq("id", data.businessId);

    await writeAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "business.badge",
      targetType: "business",
      targetId: data.businessId,
      priorValue: { badgeOverride: prior?.badge_override ?? null },
      newValue: { badgeOverride: data.value },
      reason: data.reason,
    });
    return { ok: true };
  });

export const adjustBusinessVotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { businessId: string; count: number; averageStars: number; reason: string }) =>
    z
      .object({
        businessId: z.string().uuid(),
        count: z.number().int().min(-100000).max(100000),
        averageStars: z.number().min(0).max(5),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin, writeAudit } = await import("./guards.server");
    const actor = await requireAdmin(context.userId, context.claims);

    const { data: prior } = await supabaseAdmin
      .from("businesses")
      .select("adjust_count, adjust_sum")
      .eq("id", data.businessId)
      .maybeSingle();
    if (!prior) throw new Error("Business not found.");

    const nextCount = prior.adjust_count + data.count;
    const nextSum = Number(prior.adjust_sum) + data.count * data.averageStars;
    if (nextCount < 0) throw new Error("Adjustment would make the count negative.");

    await supabaseAdmin
      .from("businesses")
      .update({ adjust_count: nextCount, adjust_sum: nextSum })
      .eq("id", data.businessId);

    await writeAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "business.vote_adjust",
      targetType: "business",
      targetId: data.businessId,
      priorValue: { adjustCount: prior.adjust_count, adjustSum: Number(prior.adjust_sum) },
      newValue: { adjustCount: nextCount, adjustSum: nextSum },
      reason: data.reason,
    });
    return { ok: true };
  });

export const adminTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminTicket[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("./guards.server");
    await requireAdmin(context.userId, context.claims);

    const { data: tickets } = await supabaseAdmin
      .from("support_tickets")
      .select("id, subject, status, created_at, updated_at, user_id")
      .order("updated_at", { ascending: false })
      .limit(200);

    const ids = [...new Set((tickets ?? []).map((t) => t.user_id))];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, email").in("id", ids)
      : { data: [] as { id: string; email: string }[] };
    const emails = new Map((profiles ?? []).map((p) => [p.id, p.email]));

    return (tickets ?? []).map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      userEmail: emails.get(t.user_id) ?? "",
    }));
  });

export const setTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ticketId: string; status: "open" | "resolved" }) =>
    z
      .object({ ticketId: z.string().uuid(), status: z.enum(["open", "resolved"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin, writeAudit } = await import("./guards.server");
    const actor = await requireAdmin(context.userId, context.claims);

    const { data: prior } = await supabaseAdmin
      .from("support_tickets")
      .select("status")
      .eq("id", data.ticketId)
      .maybeSingle();

    await supabaseAdmin
      .from("support_tickets")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.ticketId);

    await writeAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "ticket.status",
      targetType: "ticket",
      targetId: data.ticketId,
      priorValue: { status: prior?.status ?? null },
      newValue: { status: data.status },
      reason: "Support triage",
    });
    return { ok: true };
  });
