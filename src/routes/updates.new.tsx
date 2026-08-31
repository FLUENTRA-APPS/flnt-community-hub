import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { createPoll } from "@/lib/polls.functions";
import { AccountGate } from "@/components/gate";
import { PageHeader, Shell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/updates/new")({
  head: () => ({
    meta: [
      { title: "Propose an update for a community vote — flnt" },
      {
        name: "description",
        content:
          "Describe the change, explain why it matters, and flnt mints a unique public link for the vote.",
      },
      { property: "og:title", content: "Propose an update — flnt" },
      {
        property: "og:description",
        content: "Put your proposal to the community with a transparent Yes/No vote.",
      },
    ],
  }),
  component: NewUpdatePage,
});

function NewUpdatePage() {
  return (
    <Shell>
      <PageHeader
        eyebrow="Updates"
        title="Propose an update"
        description="Your email address stays private — only you and site administrators can see it."
      />
      <div className="mx-auto max-w-2xl px-4 pb-20">
        <AccountGate>
          <NewUpdateForm />
        </AccountGate>
      </div>
    </Shell>
  );
}

function NewUpdateForm() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    authorDisplayName: "",
    authorEmail: "",
    description: "",
    explanation: "",
  });

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { code } = await createPoll({ data: form });
      toast.success("Your update is live.");
      navigate({ to: "/$code", params: { code } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish the update.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Update topic</Label>
        <Input id="title" required minLength={3} maxLength={160} value={form.title} onChange={set("title")} placeholder="Move the weekly meet to Thursdays" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="authorDisplayName">Original author (public)</Label>
          <Input
            id="authorDisplayName"
            required
            maxLength={80}
            value={form.authorDisplayName}
            onChange={set("authorDisplayName")}
            placeholder="How your name appears"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="authorEmail">Author email (private)</Label>
          <Input
            id="authorEmail"
            type="email"
            required
            value={form.authorEmail}
            onChange={set("authorEmail")}
            placeholder="Never shown publicly"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Topic description</Label>
        <Textarea id="description" required minLength={10} maxLength={5000} rows={5} value={form.description} onChange={set("description")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="explanation">Why are you proposing this?</Label>
        <Textarea id="explanation" required minLength={10} maxLength={5000} rows={5} value={form.explanation} onChange={set("explanation")} />
      </div>
      <Button type="submit" disabled={busy} size="lg">
        {busy ? "Publishing…" : "Publish update"}
      </Button>
    </form>
  );
}
