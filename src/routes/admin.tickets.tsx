import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { adminTickets, setTicketStatus } from "@/lib/admin.functions";
import { AccountGate } from "@/components/gate";
import { PageHeader, Shell } from "@/components/site-shell";
import { Thread } from "./support";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/tickets")({
  head: () => ({
    meta: [
      { title: "Support tickets — flnt admin" },
      { name: "description", content: "Administrator view of every flnt support ticket." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Support tickets — flnt admin" },
      { property: "og:description", content: "Restricted area for flnt administrators." },
    ],
  }),
  component: AdminTicketsPage,
});

function AdminTicketsPage() {
  return (
    <Shell>
      <PageHeader eyebrow="Admin" title="Support tickets" description="Reply to members and resolve conversations." />
      <div className="mx-auto max-w-4xl px-4 pb-20">
        <AccountGate>
          <TicketsInner />
        </AccountGate>
      </div>
    </Shell>
  );
}

function TicketsInner() {
  const tickets = useQuery({ queryKey: ["admin-tickets"], queryFn: () => adminTickets() });
  const [openId, setOpenId] = useState<string | null>(null);

  if (tickets.isError) return <p className="text-destructive">You don't have access to this area.</p>;

  async function toggle(id: string, status: "open" | "resolved") {
    try {
      await setTicketStatus({ data: { ticketId: id, status } });
      toast.success("Ticket updated.");
      tickets.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the ticket.");
    }
  }

  return (
    <ul className="space-y-3">
      {(tickets.data ?? []).map((t) => (
        <li key={t.id} className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">{t.subject}</p>
              <p className="text-xs text-muted-foreground">
                {t.userEmail} · {t.status} · updated {new Date(t.updatedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setOpenId(openId === t.id ? null : t.id)}>
                {openId === t.id ? "Hide" : "Open"}
              </Button>
              <Button size="sm" onClick={() => toggle(t.id, t.status === "open" ? "resolved" : "open")}>
                {t.status === "open" ? "Resolve" : "Reopen"}
              </Button>
            </div>
          </div>
          {openId === t.id && <Thread ticketId={t.id} />}
        </li>
      ))}
      {!tickets.isLoading && !tickets.data?.length && (
        <li className="text-sm text-muted-foreground">No tickets yet.</li>
      )}
    </ul>
  );
}
