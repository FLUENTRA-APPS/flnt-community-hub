import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AuditDoc, SupportDoc, TrustDoc, UsersDoc } from "./data-types";

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

export const adminOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ users: AdminUser[]; businesses: AdminBusiness[]; audit: AuditEntry[] }> => {
    const { requireAdmin } = await import("./guards.server");
    const { readDoc } = await import("./store.server");
    const { computeStats } = await import("./trust.functions");
    await requireAdmin();

    const [users, trust, audit] = await Promise.all([
      readDoc<UsersDoc>("users.json"),
      readDoc<TrustDoc>("trust.json"),
      readDoc<AuditDoc>("audit.json"),
    ]);

    return {
      users: [...users.users]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((u) => ({
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          emailVerified: u.emailVerified,
          isAdmin: u.roles.includes("admin"),
          createdAt: u.createdAt,
        })),
      businesses: trust.businesses
        .map((b) => {
          const stats = computeStats(b, trust.ratings);
          return {
            id: stats.id,
            slug: stats.slug,
            sellerName: stats.sellerName,
            organicCount: stats.organicCount,
            organicAvg: stats.organicAvg,
            adjustCount: stats.adjustCount,
            totalCount: stats.totalCount,
            totalAvg: stats.totalAvg,
            verified: stats.verified,
            badgeOverride: stats.badgeOverride,
          };
        })
        .sort((a, b) => b.totalCount - a.totalCount),
      audit: audit.entries.slice(0, 100).map((a) => ({
        id: a.id,
        actorEmail: a.actorEmail,
        action: a.action,
        targetType: a.targetType,
        targetId: a.targetId,
        reason: a.reason,
        createdAt: a.createdAt,
      })),
    };
  },
);

export const setUserVerification = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; verified: boolean; reason: string }) =>
    z
      .object({
        userId: z.string().uuid(),
        verified: z.boolean(),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, writeAudit } = await import("./guards.server");
    const { mutateDoc } = await import("./store.server");
    const actor = await requireAdmin();

    const prior = await mutateDoc<UsersDoc, boolean | null>("users.json", (doc) => {
      const user = doc.users.find((u) => u.id === data.userId);
      if (!user) throw new Error("User not found.");
      const was = user.emailVerified;
      user.emailVerified = data.verified;
      return was;
    });

    await writeAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "user.verification",
      targetType: "user",
      targetId: data.userId,
      priorValue: { emailVerified: prior },
      newValue: { emailVerified: data.verified },
      reason: data.reason,
    });
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; makeAdmin: boolean; reason: string }) =>
    z
      .object({
        userId: z.string().uuid(),
        makeAdmin: z.boolean(),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, writeAudit } = await import("./guards.server");
    const { mutateDoc } = await import("./store.server");
    const actor = await requireAdmin();
    if (data.userId === actor.userId && !data.makeAdmin) {
      throw new Error("You cannot remove your own admin role.");
    }

    await mutateDoc<UsersDoc, void>("users.json", (doc) => {
      const user = doc.users.find((u) => u.id === data.userId);
      if (!user) throw new Error("User not found.");
      const roles = new Set(user.roles);
      if (data.makeAdmin) roles.add("admin");
      else roles.delete("admin");
      user.roles = [...roles];
    });

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
  .inputValidator((input: { businessId: string; value: boolean | null; reason: string }) =>
    z
      .object({
        businessId: z.string().uuid(),
        value: z.boolean().nullable(),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, writeAudit } = await import("./guards.server");
    const { mutateDoc } = await import("./store.server");
    const actor = await requireAdmin();

    const prior = await mutateDoc<TrustDoc, boolean | null>("trust.json", (doc) => {
      const business = doc.businesses.find((b) => b.id === data.businessId);
      if (!business) throw new Error("Business not found.");
      const was = business.badgeOverride;
      business.badgeOverride = data.value;
      return was;
    });

    await writeAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "business.badge",
      targetType: "business",
      targetId: data.businessId,
      priorValue: { badgeOverride: prior },
      newValue: { badgeOverride: data.value },
      reason: data.reason,
    });
    return { ok: true };
  });

export const adjustBusinessVotes = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { businessId: string; count: number; averageStars: number; reason: string }) =>
      z
        .object({
          businessId: z.string().uuid(),
          count: z.number().int().min(-100000).max(100000),
          averageStars: z.number().min(0).max(5),
          reason: z.string().trim().min(3).max(500),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, writeAudit } = await import("./guards.server");
    const { mutateDoc } = await import("./store.server");
    const actor = await requireAdmin();

    const change = await mutateDoc<
      TrustDoc,
      { priorCount: number; priorSum: number; nextCount: number; nextSum: number }
    >("trust.json", (doc) => {
      const business = doc.businesses.find((b) => b.id === data.businessId);
      if (!business) throw new Error("Business not found.");
      const nextCount = business.adjustCount + data.count;
      const nextSum = business.adjustSum + data.count * data.averageStars;
      if (nextCount < 0) throw new Error("Adjustment would make the count negative.");
      const priorCount = business.adjustCount;
      const priorSum = business.adjustSum;
      business.adjustCount = nextCount;
      business.adjustSum = nextSum;
      return { priorCount, priorSum, nextCount, nextSum };
    });

    await writeAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "business.vote_adjust",
      targetType: "business",
      targetId: data.businessId,
      priorValue: { adjustCount: change.priorCount, adjustSum: change.priorSum },
      newValue: { adjustCount: change.nextCount, adjustSum: change.nextSum },
      reason: data.reason,
    });
    return { ok: true };
  });

export const adminTickets = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminTicket[]> => {
    const { requireAdmin } = await import("./guards.server");
    const { readDoc } = await import("./store.server");
    await requireAdmin();

    const [support, users] = await Promise.all([
      readDoc<SupportDoc>("support.json"),
      readDoc<UsersDoc>("users.json"),
    ]);
    const emails = new Map(users.users.map((u) => [u.id, u.email]));

    return [...support.tickets]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 200)
      .map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        userEmail: emails.get(t.userId) ?? "",
      }));
  },
);

export const setTicketStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { ticketId: string; status: "open" | "resolved" }) =>
    z.object({ ticketId: z.string().uuid(), status: z.enum(["open", "resolved"]) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, writeAudit } = await import("./guards.server");
    const { mutateDoc } = await import("./store.server");
    const actor = await requireAdmin();

    const prior = await mutateDoc<SupportDoc, string | null>("support.json", (doc) => {
      const ticket = doc.tickets.find((t) => t.id === data.ticketId);
      if (!ticket) throw new Error("Ticket not found.");
      const was = ticket.status;
      ticket.status = data.status;
      ticket.updatedAt = new Date().toISOString();
      return was;
    });

    await writeAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "ticket.status",
      targetType: "ticket",
      targetId: data.ticketId,
      priorValue: { status: prior },
      newValue: { status: data.status },
      reason: "Support triage",
    });
    return { ok: true };
  });
