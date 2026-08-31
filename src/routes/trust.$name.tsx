import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { getBusiness, submitRating } from "@/lib/trust.functions";
import { useSession } from "@/hooks/use-session";
import { Shell } from "@/components/site-shell";
import { StarDisplay, StarInput, VerifiedBadge } from "@/components/stars";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SITE_URL } from "@/lib/site";

export const Route = createFileRoute("/trust/$name")({
  loader: async ({ params }) => {
    const result = await getBusiness({ data: { slug: params.name } });
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Business unavailable — flnt" }, { name: "robots", content: "noindex" }],
      };
    }
    const { business, reviews } = loaderData;
    const description = `${business.totalAvg.toFixed(1)} out of 5 from ${business.totalCount} ratings. ${
      reviews[0]?.review?.slice(0, 120) ?? `${business.sellerName} · ${business.businessType}`
    }`;
    const image = `${SITE_URL}/api/public/og/trust/${params.name}.png`;
    return {
      meta: [
        { title: `${business.slug} reviews and rating — flnt trust` },
        { name: "description", content: description },
        { property: "og:title", content: `${business.slug} — flnt trust` },
        { property: "og:description", content: description },
        { property: "og:image", content: image },
        { name: "twitter:image", content: image },
      ],
    };
  },
  component: BusinessPage,
});

function BusinessPage() {
  const { business, reviews } = Route.useLoaderData();
  const { ready, signedIn } = useSession();
  const [stars, setStars] = useState(5);
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submitRating({ data: { businessId: business.id, stars, review } });
      toast.success("Thanks — your rating is in.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your rating.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-3xl px-4 py-14">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold sm:text-4xl">{business.slug}</h1>
          {business.verified && <VerifiedBadge />}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {business.sellerName} · {business.businessType}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-6">
          <StarDisplay value={business.totalAvg} size={24} />
          <p className="text-3xl font-bold">{business.totalAvg.toFixed(1)}</p>
          <p className="text-sm text-muted-foreground">
            {business.totalCount} ratings
            {business.adjustCount > 0 && (
              <> · {business.organicCount} organic, {business.adjustCount} administratively adjusted</>
            )}
          </p>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Leave a rating</h2>
          {!signedIn ? (
            <p className="mt-3 text-sm text-muted-foreground">
              <Link to="/auth" className="text-primary hover:underline">
                Sign in
              </Link>{" "}
              to rate this business.
            </p>
          ) : !ready ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Confirm your emailed code to rate —{" "}
              <Link to="/verify" search={{ purpose: "login" }} className="text-primary hover:underline">
                enter it here
              </Link>
              .
            </p>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-4">
              <StarInput value={stars} onChange={setStars} disabled={busy} />
              <Textarea
                rows={4}
                maxLength={2000}
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="How was your experience?"
                aria-label="Your review"
              />
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Submit rating"}
              </Button>
              <p className="text-xs text-muted-foreground">
                One rating per business every 24 hours, enforced on the server.
              </p>
            </form>
          )}
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-lg font-semibold">Reviews ({reviews.length})</h2>
          <ul className="mt-6 space-y-6">
            {reviews.map((r) => (
              <li key={r.id}>
                <div className="flex items-center gap-2">
                  <StarDisplay value={r.stars} size={14} />
                  <span className="text-sm font-semibold">{r.authorName}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {r.review && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{r.review}</p>
                )}
              </li>
            ))}
            {!reviews.length && (
              <li className="text-sm text-muted-foreground">No reviews yet.</li>
            )}
          </ul>
        </section>
      </div>
    </Shell>
  );
}
