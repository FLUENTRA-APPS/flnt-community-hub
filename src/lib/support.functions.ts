import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Ticket = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  userEmail?: string;
};

export type TicketMessage = {
  id: string;
  body: string;
  fromAdmin: boolean;
  createdAt: string;
};

export const myTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Ticket[]> => {
    const { data } = await context.supabase
      .from("support_tickets")
      .select("id, subject, status, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return (data ?? []).map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));
  });

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { subject: string; body: string }) =>
    z
      .object({
        subject: z.string().trim().min(3).max(140),
        body: z.string().trim().min(5).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireVerifiedAccount } = await import("./guards.server");
    const account = await requireVerifiedAccount(context.userId, context.claims);

    const { data: open } = await supabaseAdmin
      .from("support_tickets")
      .select("id")
      .eq("user_id", account.userId)
      .eq("status", "open")
      .maybeSingle();
    if (open) throw new Error("You already have an open ticket. Continue that conversation.");

    const { data: ticket, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({ user_id: account.userId, subject: data.subject })
      .select("id")
      .single();
    if (error || !ticket) throw new Error("Could not open the ticket.");

    await supabaseAdmin.from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: account.userId,
      from_admin: false,
      body: data.body,
    });
    return { id: ticket.id };
  });

export const ticketThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ticketId: string }) =>
    z.object({ ticketId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ticket: Ticket; messages: TicketMessage[] }> => {
    const { data: ticket } = await context.supabase
      .from("support_tickets")
      .select("id, subject, status, created_at, updated_at")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!ticket) throw new Error("Ticket not found.");

    const { data: messages } = await context.supabase
      .from("ticket_messages")
      .select("id, body, from_admin, created_at")
      .eq("ticket_id", data.ticketId)
      .order("created_at", { ascending: true });

    return {
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at,
      },
      messages: (messages ?? []).map((m) => ({
        id: m.id,
        body: m.body,
        fromAdmin: m.from_admin,
        createdAt: m.created_at,
      })),
    };
  });

export const replyToTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ticketId: string; body: string }) =>
    z
      .object({ ticketId: z.string().uuid(), body: z.string().trim().min(1).max(4000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireVerifiedAccount } = await import("./guards.server");
    const account = await requireVerifiedAccount(context.userId, context.claims);
    const admin = account.isAdmin;


    const { data: ticket } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, status")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!ticket) throw new Error("Ticket not found.");
    if (!admin && ticket.user_id !== account.userId) throw new Error("Not allowed.");
    if (ticket.status !== "open") throw new Error("This ticket is resolved.");

    await supabaseAdmin.from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: account.userId,
      from_admin: admin,
      body: data.body,
    });
    await supabaseAdmin
      .from("support_tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", ticket.id);
    return { ok: true };
  });
