import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listPolls } from "@/lib/polls.functions";
import { PageHeader, Shell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/updates/")({
  head: () => ({
    meta: [
      { title: "Open updates up for a vote — flnt" },
      {
        name: "description",
        content:
          "Every proposed update on flnt, with live Yes/No tallies, the author's reasoning and a public link anyone can read.",
      },
      { property: "og:title", content: "Open updates up for a vote — flnt" },
      {
        property: "og:description",
        content: "Read the proposals and cast one honest vote on each.",
      },
    ],
  }),
  component: UpdatesIndex,
});

function UpdatesIndex() {
  const { data, isLoading } = useQuery({
    queryKey: ["polls"],
    queryFn: () => listPolls(),
  });

  return (
    <Shell>
      <PageHeader
        eyebrow="Updates"
        title="Proposals the community is deciding"
        description="One vote per member, changeable at any time. Every update has its own public 10-digit link."
        action={
          <Button asChild>
            <Link to="/updates/new">Propose an update</Link>
          </Button>
        }
      />

      <div className="mx-auto max-w-6xl px-4 pb-20">
        {isLoading ? (
          <p className="text-muted-foreground">Loading updates…</p>
        ) : !data?.length ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <p className="text-lg font-semibold">No updates yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Be the first to put something to the community.
            </p>
            <Button className="mt-6" asChild>
              <Link to="/updates/new">Propose an update</Link>
            </Button>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {data.map((poll) => {
              const total = poll.yesCount + poll.noCount;
              const pct = total ? Math.round((poll.yesCount / total) * 100) : 0;
              return (
                <li key={poll.id}>
                  <Link
                    to="/$code"
                    params={{ code: poll.code }}
                    className="flex h-full flex-col rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary"
                  >
                    <p className="text-xs font-mono text-muted-foreground">/{poll.code}</p>
                    <h2 className="mt-2 text-lg font-semibold">{poll.title}</h2>
                    <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
                      {poll.description}
                    </p>
                    <div className="mt-5">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {pct}% yes · {poll.yesCount} yes · {poll.noCount} no · {total} votes · by{" "}
                        {poll.authorDisplayName}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Shell>
  );
}
