import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { createTicket, myTickets, replyToTicket, ticketThread } from "@/lib/support.functions";
import { AccountGate } from "@/components/gate";
import { PageHeader, Shell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — talk to the flnt team" },
      {
        name: "description",
        content:
          "Open one support ticket at a time and hold a real conversation with the flnt moderation team.",
      },
      { property: "og:title", content: "flnt support" },
      { property: "og:description", content: "One open ticket, one clear conversation." },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <Shell>
      <PageHeader
        eyebrow="Support"
        title="Get help from the flnt team"
        description="You can keep one ticket open at a time. Once it's resolved you can open another."
      />
      <div className="mx-auto max-w-3xl px-4 pb-20">
        <AccountGate>
          <SupportInner />
        </AccountGate>
      </div>
    </Shell>
  );
}

function SupportInner() {
  const tickets = useQuery({ queryKey: ["my-tickets"], queryFn: () => myTickets() });
  const [openId, setOpenId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const hasOpen = (tickets.data ?? []).some((t) => t.status === "open");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createTicket({ data: { subject, body } });
      setSubject("");
      setBody("");
      toast.success("Ticket opened.");
      tickets.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open a ticket.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-12">
      {!hasOpen && (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Open a ticket</h2>
          <div className="space-y-2">
            <Label htmlFor="subject">Reason</Label>
            <Input id="subject" required minLength={3} maxLength={140} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">What's happening?</Label>
            <Textarea id="body" required minLength={5} rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Open ticket"}
          </Button>
        </form>
      )}

      <section>
        <h2 className="text-lg font-semibold">Your tickets</h2>
        <ul className="mt-4 space-y-3">
          {(tickets.data ?? []).map((t) => (
            <li key={t.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.status} · updated {new Date(t.updatedAt).toLocaleString()}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setOpenId(openId === t.id ? null : t.id)}>
                  {openId === t.id ? "Hide" : "Open"}
                </Button>
              </div>
              {openId === t.id && <Thread ticketId={t.id} />}
            </li>
          ))}
          {!tickets.isLoading && !tickets.data?.length && (
            <li className="text-sm text-muted-foreground">No tickets yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

export function Thread({ ticketId }: { ticketId: string }) {
  const thread = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => ticketThread({ data: { ticketId } }),
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await replyToTicket({ data: { ticketId, body: message } });
      setMessage("");
      thread.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send your message.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <ul className="space-y-3">
        {(thread.data?.messages ?? []).map((m) => (
          <li
            key={m.id}
            className={`rounded-lg p-3 text-sm ${m.fromAdmin ? "bg-secondary" : "bg-accent/40"}`}
          >
            <p className="text-xs font-semibold">{m.fromAdmin ? "flnt team" : "You"}</p>
            <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ul>
      {thread.data?.ticket.status === "open" ? (
        <form onSubmit={send} className="mt-4 space-y-2">
          <Textarea
            rows={3}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            aria-label="Your message"
            placeholder="Write a message"
          />
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Sending…" : "Send"}
          </Button>
        </form>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">This ticket is resolved.</p>
      )}
    </div>
  );
}
