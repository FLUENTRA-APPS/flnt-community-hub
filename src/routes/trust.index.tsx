import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listBusinesses } from "@/lib/trust.functions";
import { PageHeader, Shell } from "@/components/site-shell";
import { StarDisplay, VerifiedBadge } from "@/components/stars";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/trust/")({
  head: () => ({
    meta: [
      { title: "Trusted businesses and sellers — flnt" },
      {
        name: "description",
        content:
          "Browse businesses rated by verified flnt members. Half-star ratings, written reviews, and a blue tick only volume and score can earn.",
      },
      { property: "og:title", content: "Trusted businesses — flnt" },
      {
        property: "og:description",
        content: "Real ratings from verified members, one per person per day.",
      },
    ],
  }),
  component: TrustIndex,
});

function TrustIndex() {
  const { data, isLoading } = useQuery({ queryKey: ["businesses"], queryFn: () => listBusinesses() });

  return (
    <Shell>
      <PageHeader
        eyebrow="Trust"
        title="Businesses the community vouches for"
        description="Ratings move in half stars. Members can rate each business once every 24 hours."
        action={
          <Button asChild>
            <Link to="/trust/become">List your business</Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-6xl px-4 pb-20">
        {isLoading ? (
          <p className="text-muted-foreground">Loading directory…</p>
        ) : !data?.length ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <p className="text-lg font-semibold">No businesses listed yet</p>
            <Button className="mt-6" asChild>
              <Link to="/trust/become">Be the first</Link>
            </Button>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.map((b) => (
              <li key={b.id}>
                <Link
                  to="/trust/$name"
                  params={{ name: b.slug }}
                  className="flex h-full flex-col rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary"
                >
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{b.slug}</h2>
                    {b.verified && <VerifiedBadge />}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {b.sellerName} · {b.businessType}
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <StarDisplay value={b.totalAvg} />
                    <span className="text-sm font-medium">{b.totalAvg.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">({b.totalCount} ratings)</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}
