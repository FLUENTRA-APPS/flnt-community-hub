import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createPollSchema,
  mapPoll,
  POLL_SELECT,
  type PollComment,
  type PublicPoll,
} from "./poll-mappers";

export const listPolls = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPoll[]> => {
    const { publicClient } = await import("./server-shared.server");
    const { data } = await publicClient()
      .from("polls")
      .select(POLL_SELECT)
      .order("created_at", { ascending: false })
      .limit(60);
    return (data ?? []).map(mapPoll);
  },
);

export const getPollByCode = createServerFn({ method: "GET" })
  .inputValidator((input: { code: string }) =>
    z.object({ code: z.string().regex(/^\d{10}$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ poll: PublicPoll; comments: PollComment[] } | null> => {
    const { publicClient } = await import("./server-shared.server");
    const client = publicClient();
    const { data: poll } = await client
      .from("polls")
      .select(POLL_SELECT)
      .eq("code", data.code)
      .maybeSingle();
    if (!poll) return null;

    const { data: comments } = await client
      .from("poll_comments")
      .select("id, parent_id, author_name, body, created_at")
      .eq("poll_id", poll.id)
      .order("created_at", { ascending: true })
      .limit(500);

    return {
      poll: mapPoll(poll),
      comments: (comments ?? []).map((c) => ({
        id: c.id,
        parentId: c.parent_id,
        authorName: c.author_name,
        body: c.body,
        createdAt: c.created_at,
      })),
    };
  });

export const createPoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof createPollSchema>) => createPollSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ code: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireVerifiedAccount } = await import("./guards.server");
    const account = await requireVerifiedAccount(context.userId, context.claims);

    // Abuse protection: max 5 new updates per account per day.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("polls")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", account.userId)
      .gte("created_at", since);
    if ((count ?? 0) >= 5) throw new Error("You can create up to 5 updates per day.");

    let code = "";
    for (let attempt = 0; attempt < 6; attempt++) {
      const candidate = String(Math.floor(1_000_000_000 + Math.random() * 9_000_000_000));
      const { data: clash } = await supabaseAdmin
        .from("polls")
        .select("id")
        .eq("code", candidate)
        .maybeSingle();
      if (!clash) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("Could not allocate a public link. Try again.");

    const { data: poll, error } = await supabaseAdmin
      .from("polls")
      .insert({
        code,
        owner_id: account.userId,
        title: data.title,
        author_display_name: data.authorDisplayName,
        description: data.description,
        explanation: data.explanation,
      })
      .select("id, code")
      .single();
    if (error || !poll) throw new Error("Could not create the update.");

    await supabaseAdmin
      .from("poll_private")
      .insert({ poll_id: poll.id, author_email: data.authorEmail.toLowerCase() });

    return { code: poll.code };
  });

export const getMyVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pollId: string }) =>
    z.object({ pollId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ choice: boolean | null }> => {
    const { data: vote } = await context.supabase
      .from("poll_votes")
      .select("choice")
      .eq("poll_id", data.pollId)
      .eq("user_id", context.userId)
      .maybeSingle();
    return { choice: vote?.choice ?? null };
  });

export const castVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pollId: string; choice: boolean }) =>
    z.object({ pollId: z.string().uuid(), choice: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ yes: number; no: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireVerifiedAccount } = await import("./guards.server");
    const { notifyMilestoneIfNeeded } = await import("./poll-notify.server");
    const account = await requireVerifiedAccount(context.userId, context.claims);

    const { error } = await supabaseAdmin.from("poll_votes").upsert(
      {
        poll_id: data.pollId,
        user_id: account.userId,
        choice: data.choice,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "poll_id,user_id" },
    );
    if (error) throw new Error("Could not record your vote.");

    const { data: poll } = await supabaseAdmin
      .from("polls")
      .select("id, code, title, yes_count, no_count, milestone_notified")
      .eq("id", data.pollId)
      .single();
    if (!poll) throw new Error("Update not found.");

    await notifyMilestoneIfNeeded(poll);
    return { yes: poll.yes_count, no: poll.no_count };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pollId: string; body: string; parentId?: string | null }) =>
    z
      .object({
        pollId: z.string().uuid(),
        body: z.string().trim().min(1).max(2000),
        parentId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireVerifiedAccount } = await import("./guards.server");
    const account = await requireVerifiedAccount(context.userId, context.claims);

    const since = new Date(Date.now() - 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("poll_comments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", account.userId)
      .gte("created_at", since);
    if ((count ?? 0) >= 5) throw new Error("You're posting too fast. Wait a moment.");

    const { error } = await supabaseAdmin.from("poll_comments").insert({
      poll_id: data.pollId,
      user_id: account.userId,
      parent_id: data.parentId ?? null,
      author_name: account.displayName || "member",
      body: data.body,
    });
    if (error) throw new Error("Could not post your reply.");
    return { ok: true };
  });
