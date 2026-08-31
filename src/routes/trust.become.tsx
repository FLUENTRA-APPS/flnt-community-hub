import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { createBusiness } from "@/lib/trust.functions";
import { AccountGate } from "@/components/gate";
import { PageHeader, Shell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/trust/become")({
  head: () => ({
    meta: [
      { title: "List your business on flnt trust" },
      {
        name: "description",
        content:
          "Claim a short public name and start collecting honest, rate-limited reviews from verified flnt members.",
      },
      { property: "og:title", content: "List your business — flnt" },
      { property: "og:description", content: "Claim your public trust page in a minute." },
    ],
  }),
  component: BecomePage,
});

function BecomePage() {
  return (
    <Shell>
      <PageHeader
        eyebrow="Trust"
        title="List your business"
        description="Pick a short public name — up to 15 characters. It becomes your public URL."
      />
      <div className="mx-auto max-w-xl px-4 pb-20">
        <AccountGate>
          <BecomeForm />
        </AccountGate>
      </div>
    </Shell>
  );
}

function BecomeForm() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ sellerName: "", businessType: "", slug: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createBusiness({ data: form });
      toast.success("Your listing is live.");
      navigate({ to: "/trust/$name", params: { name: form.slug.toLowerCase() } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the listing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="sellerName">Seller name</Label>
        <Input
          id="sellerName"
          required
          maxLength={80}
          value={form.sellerName}
          onChange={(e) => setForm((f) => ({ ...f, sellerName: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="businessType">Business type</Label>
        <Input
          id="businessType"
          required
          maxLength={60}
          value={form.businessType}
          onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value }))}
          placeholder="Electronics reseller"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Public business name (max 15 characters)</Label>
        <Input
          id="slug"
          required
          minLength={3}
          maxLength={15}
          pattern="[a-zA-Z0-9-]+"
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
          placeholder="northgate"
        />
        <p className="text-xs text-muted-foreground">
          Your page will live at flnt.dpdns.org/trust/{form.slug || "your-name"}
        </p>
      </div>
      <Button type="submit" size="lg" disabled={busy}>
        {busy ? "Creating…" : "Create listing"}
      </Button>
    </form>
  );
}
