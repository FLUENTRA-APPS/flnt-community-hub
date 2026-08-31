import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { addComment, castVote, getMyVote, getPollByCode } from "@/lib/polls.functions";
import type { PollComment } from "@/lib/poll-mappers";
import { useSession } from "@/hooks/use-session";
import { Shell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SITE_URL } from "@/lib/site";

export const Route = createFileRoute("/$code")({
  loader: async ({ params }) => {
    if (!/^\d{10}$/.test(params.code)) throw notFound();
    const result = await getPollByCode({ data: { code: params.code } });
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Update unavailable — flnt" }, { name: "robots", content: "noindex" }] };
    }
    const { poll } = loaderData;
    const total = poll.yesCount + poll.noCount;
    const pct = total ? Math.round((poll.yesCount / total) * 100) : 0;
    const description = `${pct}% yes from ${total} votes. ${poll.description.slice(0, 140)}`;
    const image = `${SITE_URL}/api/public/og/poll/${params.code}.png`;
    return {
      meta: [
        { title: `${poll.title} — flnt update vote` },
        { name: "description", content: description },
        { property: "og:title", content: `${poll.title} — flnt` },
        { property: "og:description", content: description },
        { property: "og:image", content: image },
        { name: "twitter:image", content: image },
      ],
    };
  },
  component: PollPage,
});

function PollPage() {
  const { poll, comments } = Route.useLoaderData();
  const { code } = Route.useParams();
  const queryClient = useQueryClient();
  const { ready, signedIn } = useSession();

  const myVote = useQuery({
    queryKey: ["my-vote", poll.id],
    queryFn: () => getMyVote({ data: { pollId: poll.id } }),
    enabled: ready,
  });

  const [choice, setChoice] = useState<boolean | null>(null);
  useEffect(() => {
    if (myVote.data && myVote.data.choice !== null) setChoice(myVote.data.choice);
  }, [myVote.data]);

  const vote = useMutation({
    mutationFn: (value: boolean) => castVote({ data: { pollId: poll.id, choice: value } }),
    onSuccess: () => {
      toast.success("Your vote is recorded.");
      queryClient.invalidateQueries({ queryKey: ["my-vote", poll.id] });
      window.location.reload();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Vote failed."),
  });

  const total = poll.yesCount + poll.noCount;
  const yesPct = total ? Math.round((poll.yesCount / total) * 100) : 0;
  const recorded = myVote.data?.choice ?? null;

  return (
    <Shell>
      <article className="mx-auto max-w-3xl px-4 py-14">
        <p className="font-mono text-xs text-muted-foreground">
          {SITE_URL.replace("https://", "")}/{code}
        </p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{poll.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Proposed by {poll.authorDisplayName} · {new Date(poll.createdAt).toLocaleDateString()}
        </p>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex items-baseline justify-between">
            <p className="text-4xl font-bold">{yesPct}%</p>
            <p className="text-sm text-muted-foreground">
              {poll.yesCount} yes · {poll.noCount} no · {total} votes
            </p>
          </div>
          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary transition-all" style={{ width: `${yesPct}%` }} />
          </div>

          <div className="mt-8">
            {!signedIn ? (
              <p className="text-sm text-muted-foreground">
                <Link to="/auth" className="text-primary hover:underline">
                  Sign in
                </Link>{" "}
                to cast your vote.
              </p>
            ) : !ready ? (
              <p className="text-sm text-muted-foreground">
                Confirm your email code to vote —{" "}
                <Link to="/verify" search={{ purpose: "login" }} className="text-primary hover:underline">
                  enter it here
                </Link>
                .
              </p>
            ) : (
              <div className="space-y-4">
                <fieldset>
                  <legend className="text-sm font-medium">Your vote</legend>
                  <div className="mt-3 inline-flex rounded-lg border border-border p-1">
                    {[
                      { label: "Yes", value: true },
                      { label: "No", value: false },
                    ].map((option) => (
                      <label
                        key={option.label}
                        className={`cursor-pointer rounded-md px-8 py-2 text-sm font-medium transition-colors ${
                          choice === option.value
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <input
                          type="radio"
                          name="vote"
                          className="sr-only"
                          checked={choice === option.value}
                          onChange={() => setChoice(option.value)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Button
                  size="lg"
                  disabled={choice === null || vote.isPending || choice === recorded}
                  onClick={() => choice !== null && vote.mutate(choice)}
                >
                  {vote.isPending
                    ? "Saving…"
                    : recorded === null
                      ? "Vote"
                      : choice === recorded
                        ? `You voted ${recorded ? "Yes" : "No"}`
                        : "Change my vote"}
                </Button>
                {recorded !== null && (
                  <p className="text-xs text-muted-foreground">
                    You can change your vote at any time; only your latest choice counts.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="mt-10 space-y-8">
          <div>
            <h2 className="text-lg font-semibold">What's being proposed</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {poll.description}
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Why the author proposed it</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {poll.explanation}
            </p>
          </div>
        </section>

        <CommentSection pollId={poll.id} comments={comments} canPost={ready} />
      </article>
    </Shell>
  );
}

function CommentSection({
  pollId,
  comments,
  canPost,
}: {
  pollId: string;
  comments: PollComment[];
  canPost: boolean;
}) {
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const roots = comments.filter((c) => !c.parentId);
  const childrenOf = (id: string) => comments.filter((c) => c.parentId === id);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await addComment({ data: { pollId, body, parentId: replyTo } });
      setBody("");
      setReplyTo(null);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post your reply.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-14 border-t border-border pt-10">
      <h2 className="text-lg font-semibold">Discussion ({comments.length})</h2>

      {canPost ? (
        <form onSubmit={post} className="mt-6 space-y-3">
          {replyTo && (
            <p className="text-xs text-muted-foreground">
              Replying to a comment.{" "}
              <button type="button" className="text-primary hover:underline" onClick={() => setReplyTo(null)}>
                Cancel
              </button>
            </p>
          )}
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={2000}
            required
            placeholder="Add to the discussion"
            aria-label="Your comment"
          />
          <Button type="submit" disabled={busy || !body.trim()}>
            {busy ? "Posting…" : "Post reply"}
          </Button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Verified members can join the discussion.
        </p>
      )}

      <ul className="mt-8 space-y-6">
        {roots.map((c) => (
          <li key={c.id}>
            <CommentCard comment={c} onReply={canPost ? () => setReplyTo(c.id) : undefined} />
            <ul className="mt-4 space-y-4 border-l border-border pl-5">
              {childrenOf(c.id).map((child) => (
                <li key={child.id}>
                  <CommentCard comment={child} onReply={canPost ? () => setReplyTo(c.id) : undefined} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CommentCard({
  comment,
  onReply,
}: {
  comment: PollComment;
  onReply?: (() => void) | undefined;
}) {
  return (
    <div>
      <p className="text-sm font-semibold">
        {comment.authorName}{" "}
        <span className="font-normal text-muted-foreground">
          · {new Date(comment.createdAt).toLocaleString()}
        </span>
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{comment.body}</p>
      {onReply && (
        <button type="button" onClick={onReply} className="mt-1 text-xs text-primary hover:underline">
          Reply
        </button>
      )}
    </div>
  );
}
