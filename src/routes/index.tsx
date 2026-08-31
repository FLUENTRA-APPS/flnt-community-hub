import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, MessagesSquare, ShieldCheck, Vote } from "lucide-react";
import { Shell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "flnt — community update votes and business trust reviews" },
      {
        name: "description",
        content:
          "flnt is where communities vote on proposed updates and rate the businesses they deal with. Transparent votes, verified sellers, real reviews.",
      },
      { property: "og:title", content: "flnt — updates you vote on, businesses you can trust" },
      {
        property: "og:description",
        content:
          "Vote Yes or No on proposed updates and read honest, rate-limited business reviews on flnt.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Vote,
    title: "Update voting",
    body: "Every proposal gets a public 10-digit link, a plain-English explanation, and one honest vote per member — changeable at any time.",
    to: "/updates" as const,
    cta: "Browse updates",
  },
  {
    icon: ShieldCheck,
    title: "Trusted businesses",
    body: "Half-star ratings, written reviews and a strict one-rating-per-day rule. Verified sellers earn their blue tick on volume and score.",
    to: "/trust" as const,
    cta: "Open the directory",
  },
  {
    icon: MessagesSquare,
    title: "Support that answers",
    body: "One open ticket at a time, a real conversation with the moderation team, and a full audit trail behind every admin action.",
    to: "/support" as const,
    cta: "Get support",
  },
];

function Landing() {
  return (
    <Shell>
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            flnt.dpdns.org
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.05] sm:text-6xl">
            Decisions the community votes on. Businesses the community vouches for.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            flnt keeps two things honest: what changes around here, and who you can trust to trade
            with. No hype, no hidden scoring — just verified members, one vote each, and a public
            record.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/updates">
                See open updates <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/trust">Trusted businesses</Link>
            </Button>
            <Button size="lg" variant="ghost" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>

          <dl className="mt-16 grid gap-8 border-t border-border pt-10 sm:grid-cols-3">
            {[
              ["One member, one vote", "Change your mind any time — the count always reflects it."],
              ["Verified accounts only", "Email verification plus a fresh code on every sign-in."],
              ["Nothing private in public", "Author contact details stay with the owner and admins."],
            ].map(([term, detail]) => (
              <div key={term}>
                <dt className="flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {term}
                </dt>
                <dd className="mt-2 text-sm text-muted-foreground">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-2xl font-bold sm:text-3xl">Three places to start</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex flex-col rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary"
            >
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{f.body}</p>
              <Link
                to={f.to}
                className="mt-5 inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                {f.cta} <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">How a vote works</h2>
            <ol className="mt-6 space-y-4 text-sm text-muted-foreground">
              <li>
                <span className="font-semibold text-foreground">1. Propose.</span> A verified member
                writes the topic, the description and why the change matters.
              </li>
              <li>
                <span className="font-semibold text-foreground">2. Share.</span> flnt mints a unique
                10-digit link that anyone can read.
              </li>
              <li>
                <span className="font-semibold text-foreground">3. Decide.</span> Members pick Yes or
                No, then press Vote once. Counts and percentages update live.
              </li>
              <li>
                <span className="font-semibold text-foreground">4. Escalate.</span> Past 1,000 Yes
                votes the owner gets a one-time email with the link and the tally.
              </li>
            </ol>
          </div>
          <div>
            <h2 className="text-2xl font-bold">How trust is earned</h2>
            <ol className="mt-6 space-y-4 text-sm text-muted-foreground">
              <li>
                <span className="font-semibold text-foreground">1. List.</span> Sellers claim a short
                public name, up to 15 characters.
              </li>
              <li>
                <span className="font-semibold text-foreground">2. Rate.</span> Members leave a
                half-star rating and a written review, once per business per day.
              </li>
              <li>
                <span className="font-semibold text-foreground">3. Verify.</span> Above 5,000 eligible
                ratings and a 2.5+ average, the blue tick appears — never self-granted.
              </li>
            </ol>
          </div>
        </div>
      </section>
    </Shell>
  );
}
