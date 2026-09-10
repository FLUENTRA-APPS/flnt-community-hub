import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupportDoc } from "./data-types";

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

export const myTickets = createServerFn({ method: "GET" }).handler(async (): Promise<Ticket[]> => {
  const { requireUser } = await import("./guards.server");
  const { readDoc } = await import("./store.server");
  const user = await requireUser();
  const doc = await readDoc<SupportDoc>("support.json");
  return doc.tickets
    .filter((t) => t.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
});

export const createTicket = createServerFn({ method: "POST" })
  .inputValidator((input: { subject: string; body: string }) =>
    z
      .object({
        subject: z.string().trim().min(3).max(140),
        body: z.string().trim().min(5).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { requireVerifiedAccount } = await import("./guards.server");
    const { mutateDoc, newId } = await import("./store.server");
    const account = await requireVerifiedAccount();

    return mutateDoc<SupportDoc, { id: string }>("support.json", (doc) => {
      if (doc.tickets.some((t) => t.userId === account.userId && t.status === "open")) {
        throw new Error("You already have an open ticket. Continue that conversation.");
      }
      const now = new Date().toISOString();
      const id = newId();
      doc.tickets.push({
        id,
        userId: account.userId,
        subject: data.subject,
        status: "open",
        createdAt: now,
        updatedAt: now,
      });
      doc.messages.push({
        id: newId(),
        ticketId: id,
        senderId: account.userId,
        fromAdmin: false,
        body: data.body,
        createdAt: now,
      });
      return { id };
    });
  });

export const ticketThread = createServerFn({ method: "POST" })
  .inputValidator((input: { ticketId: string }) =>
    z.object({ ticketId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ticket: Ticket; messages: TicketMessage[] }> => {
    const { requireUser } = await import("./guards.server");
    const { isAdmin } = await import("./auth-core.server");
    const { readDoc } = await import("./store.server");
    const user = await requireUser();
    const doc = await readDoc<SupportDoc>("support.json");

    const ticket = doc.tickets.find((t) => t.id === data.ticketId);
    if (!ticket) throw new Error("Ticket not found.");
    if (ticket.userId !== user.id && !isAdmin(user)) throw new Error("Not allowed.");

    return {
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      },
      messages: doc.messages
        .filter((m) => m.ticketId === ticket.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((m) => ({
          id: m.id,
          body: m.body,
          fromAdmin: m.fromAdmin,
          createdAt: m.createdAt,
        })),
    };
  });

export const replyToTicket = createServerFn({ method: "POST" })
  .inputValidator((input: { ticketId: string; body: string }) =>
    z.object({ ticketId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireVerifiedAccount } = await import("./guards.server");
    const { mutateDoc, newId } = await import("./store.server");
    const account = await requireVerifiedAccount();

    await mutateDoc<SupportDoc, void>("support.json", (doc) => {
      const ticket = doc.tickets.find((t) => t.id === data.ticketId);
      if (!ticket) throw new Error("Ticket not found.");
      if (!account.isAdmin && ticket.userId !== account.userId) throw new Error("Not allowed.");
      if (ticket.status !== "open") throw new Error("This ticket is resolved.");

      const now = new Date().toISOString();
      doc.messages.push({
        id: newId(),
        ticketId: ticket.id,
        senderId: account.userId,
        fromAdmin: account.isAdmin,
        body: data.body,
        createdAt: now,
      });
      ticket.updatedAt = now;
    });
    return { ok: true };
  });
