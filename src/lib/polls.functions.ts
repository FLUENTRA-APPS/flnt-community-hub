import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createPollSchema, type PollComment, type PublicPoll } from "./poll-mappers";
import type { PollsDoc, PollRecord } from "./data-types";

function toPublic(poll: PollRecord, votes: { pollId: string; choice: boolean }[]): PublicPoll {
  const mine = votes.filter((v) => v.pollId === poll.id);
  return {
    id: poll.id,
    code: poll.code,
    title: poll.title,
    authorDisplayName: poll.authorDisplayName,
    description: poll.description,
    explanation: poll.explanation,
    yesCount: mine.filter((v) => v.choice).length,
    noCount: mine.filter((v) => !v.choice).length,
    createdAt: poll.createdAt,
  };
}

export const listPolls = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPoll[]> => {
    const { readDoc } = await import("./store.server");
    const doc = await readDoc<PollsDoc>("polls.json");
    return [...doc.polls]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 60)
      .map((p) => toPublic(p, doc.votes));
  },
);

export const getPollByCode = createServerFn({ method: "GET" })
  .inputValidator((input: { code: string }) =>
    z.object({ code: z.string().regex(/^\d{10}$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ poll: PublicPoll; comments: PollComment[] } | null> => {
    const { readDoc } = await import("./store.server");
    const doc = await readDoc<PollsDoc>("polls.json");
    const poll = doc.polls.find((p) => p.code === data.code);
    if (!poll) return null;

    return {
      poll: toPublic(poll, doc.votes),
      comments: doc.comments
        .filter((c) => c.pollId === poll.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, 500)
        .map((c) => ({
          id: c.id,
          parentId: c.parentId,
          authorName: c.authorName,
          body: c.body,
          createdAt: c.createdAt,
        })),
    };
  });

export const createPoll = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof createPollSchema>) => createPollSchema.parse(input))
  .handler(async ({ data }): Promise<{ code: string }> => {
    const { requireVerifiedAccount } = await import("./guards.server");
    const { mutateDoc, newId } = await import("./store.server");
    const account = await requireVerifiedAccount();

    return mutateDoc<PollsDoc, { code: string }>("polls.json", (doc) => {
      // Abuse protection: max 5 new updates per account per day.
      const since = Date.now() - 24 * 60 * 60 * 1000;
      const recent = doc.polls.filter(
        (p) => p.ownerId === account.userId && new Date(p.createdAt).getTime() > since,
      );
      if (recent.length >= 5) throw new Error("You can create up to 5 updates per day.");

      let code = "";
      for (let attempt = 0; attempt < 12 && !code; attempt++) {
        const candidate = String(Math.floor(1_000_000_000 + Math.random() * 9_000_000_000));
        if (!doc.polls.some((p) => p.code === candidate)) code = candidate;
      }
      if (!code) throw new Error("Could not allocate a public link. Try again.");

      doc.polls.push({
        id: newId(),
        code,
        ownerId: account.userId,
        title: data.title,
        authorDisplayName: data.authorDisplayName,
        authorEmail: data.authorEmail.toLowerCase(),
        description: data.description,
        explanation: data.explanation,
        milestoneNotified: false,
        createdAt: new Date().toISOString(),
      });
      return { code };
    });
  });

export const getMyVote = createServerFn({ method: "POST" })
  .inputValidator((input: { pollId: string }) =>
    z.object({ pollId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ choice: boolean | null }> => {
    const { currentUserId } = await import("./auth-core.server");
    const { readDoc } = await import("./store.server");
    const userId = await currentUserId();
    if (!userId) return { choice: null };
    const doc = await readDoc<PollsDoc>("polls.json");
    const vote = doc.votes.find((v) => v.pollId === data.pollId && v.userId === userId);
    return { choice: vote?.choice ?? null };
  });

export const castVote = createServerFn({ method: "POST" })
  .inputValidator((input: { pollId: string; choice: boolean }) =>
    z.object({ pollId: z.string().uuid(), choice: z.boolean() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ yes: number; no: number }> => {
    const { requireVerifiedAccount } = await import("./guards.server");
    const { mutateDoc } = await import("./store.server");
    const { notifyMilestoneIfNeeded } = await import("./poll-notify.server");
    const account = await requireVerifiedAccount();

    const snapshot = await mutateDoc<PollsDoc, { pollId: string; yes: number; no: number }>(
      "polls.json",
      (doc) => {
        const poll = doc.polls.find((p) => p.id === data.pollId);
        if (!poll) throw new Error("Update not found.");
        const existing = doc.votes.find(
          (v) => v.pollId === poll.id && v.userId === account.userId,
        );
        if (existing) {
          existing.choice = data.choice;
          existing.updatedAt = new Date().toISOString();
        } else {
          doc.votes.push({
            pollId: poll.id,
            userId: account.userId,
            choice: data.choice,
            updatedAt: new Date().toISOString(),
          });
        }
        const mine = doc.votes.filter((v) => v.pollId === poll.id);
        return {
          pollId: poll.id,
          yes: mine.filter((v) => v.choice).length,
          no: mine.filter((v) => !v.choice).length,
        };
      },
    );

    await notifyMilestoneIfNeeded(snapshot.pollId, snapshot.yes, snapshot.no);
    return { yes: snapshot.yes, no: snapshot.no };
  });

export const addComment = createServerFn({ method: "POST" })
  .inputValidator((input: { pollId: string; body: string; parentId?: string | null }) =>
    z
      .object({
        pollId: z.string().uuid(),
        body: z.string().trim().min(1).max(2000),
        parentId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireVerifiedAccount } = await import("./guards.server");
    const { mutateDoc, newId } = await import("./store.server");
    const account = await requireVerifiedAccount();

    await mutateDoc<PollsDoc, void>("polls.json", (doc) => {
      const since = Date.now() - 60 * 1000;
      const recent = doc.comments.filter(
        (c) => c.userId === account.userId && new Date(c.createdAt).getTime() > since,
      );
      if (recent.length >= 5) throw new Error("You're posting too fast. Wait a moment.");

      doc.comments.push({
        id: newId(),
        pollId: data.pollId,
        userId: account.userId,
        parentId: data.parentId ?? null,
        authorName: account.displayName || "member",
        body: data.body,
        createdAt: new Date().toISOString(),
      });
    });
    return { ok: true };
  });
