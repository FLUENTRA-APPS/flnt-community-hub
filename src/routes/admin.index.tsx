import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  adjustBusinessVotes,
  adminOverview,
  setBadgeOverride,
  setUserRole,
  setUserVerification,
} from "@/lib/admin.functions";
import { AccountGate } from "@/components/gate";
import { PageHeader, Shell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — flnt" },
      { name: "description", content: "Administrator tools for flnt members, businesses and audit history." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin dashboard — flnt" },
      { property: "og:description", content: "Restricted area for flnt administrators." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <Shell>
      <PageHeader
        eyebrow="Admin"
        title="Administration"
        description="Every action here is written to the audit log with actor, target, reason and prior value."
        action={
          <Button variant="outline" asChild>
            <Link to="/admin/tickets">Support tickets</Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-6xl px-4 pb-20">
        <AccountGate>
          <AdminInner />
        </AccountGate>
      </div>
    </Shell>
  );
}

function useReason() {
  const [reason, setReason] = useState("");
  return { reason, setReason };
}

function AdminInner() {
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: () => adminOverview() });
  const { reason, setReason } = useReason();

  if (overview.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (overview.isError)
    return <p className="text-destructive">You don't have access to this area.</p>;

  const data = overview.data!;

  async function run(action: Promise<unknown>) {
    try {
      await action;
      toast.success("Done.");
      overview.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    }
  }

  return (
    <div className="space-y-12">
      <div className="space-y-2">
        <label htmlFor="reason" className="text-sm font-medium">
          Reason (recorded in the audit log)
        </label>
        <Input
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why are you making this change?"
        />
      </div>

      <section>
        <h2 className="text-lg font-semibold">Members ({data.users.length})</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Email</th>
                <th>Name</th>
                <th>Verified</th>
                <th>Admin</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="py-2">{u.email}</td>
                  <td>{u.displayName}</td>
                  <td>{u.emailVerified ? "Yes" : "No"}</td>
                  <td>{u.isAdmin ? "Yes" : "No"}</td>
                  <td className="space-x-2 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        run(
                          setUserVerification({
                            data: { userId: u.id, verified: !u.emailVerified, reason },
                          }),
                        )
                      }
                    >
                      {u.emailVerified ? "Unverify" : "Verify"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        run(setUserRole({ data: { userId: u.id, makeAdmin: !u.isAdmin, reason } }))
                      }
                    >
                      {u.isAdmin ? "Remove admin" : "Make admin"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Businesses ({data.businesses.length})</h2>
        <ul className="mt-4 space-y-4">
          {data.businesses.map((b) => (
            <li key={b.id} className="rounded-lg border border-border p-4">
              <p className="font-medium">
                {b.slug} <span className="text-muted-foreground">· {b.sellerName}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                organic {b.organicCount} @ {b.organicAvg.toFixed(2)} · adjusted {b.adjustCount} ·
                total {b.totalCount} @ {b.totalAvg.toFixed(2)} · badge{" "}
                {b.badgeOverride === null ? "automatic" : b.badgeOverride ? "forced on" : "forced off"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => run(setBadgeOverride({ data: { businessId: b.id, value: true, reason } }))}>
                  Grant badge
                </Button>
                <Button size="sm" variant="outline" onClick={() => run(setBadgeOverride({ data: { businessId: b.id, value: false, reason } }))}>
                  Revoke badge
                </Button>
                <Button size="sm" variant="ghost" onClick={() => run(setBadgeOverride({ data: { businessId: b.id, value: null, reason } }))}>
                  Automatic
                </Button>
                <AdjustForm businessId={b.id} reason={reason} onDone={() => overview.refetch()} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Audit log</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {data.audit.map((a) => (
            <li key={a.id} className="border-b border-border pb-2">
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(a.createdAt).toLocaleString()}
              </span>{" "}
              {a.actorEmail} — {a.action} on {a.targetType} {a.targetId}
              {a.reason && <span className="text-muted-foreground"> · {a.reason}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AdjustForm({
  businessId,
  reason,
  onDone,
}: {
  businessId: string;
  reason: string;
  onDone: () => void;
}) {
  const [count, setCount] = useState("0");
  const [avg, setAvg] = useState("5");

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await adjustBusinessVotes({
            data: {
              businessId,
              count: Number(count),
              averageStars: Number(avg),
              reason,
            },
          });
          toast.success("Adjustment recorded.");
          onDone();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Adjustment failed.");
        }
      }}
    >
      <Input className="w-28" value={count} onChange={(e) => setCount(e.target.value)} aria-label="Adjustment count" />
      <Input className="w-24" value={avg} onChange={(e) => setAvg(e.target.value)} aria-label="Adjustment average stars" />
      <Button size="sm" type="submit">
        Adjust votes
      </Button>
    </form>
  );
}
