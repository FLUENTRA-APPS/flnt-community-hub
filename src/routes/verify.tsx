import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { requestEmailCode, verifyEmailCode } from "@/lib/auth.functions";
import { useSession } from "@/hooks/use-session";
import { Shell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({
  purpose: z.enum(["signup", "login"]).catch("login"),
});

export const Route = createFileRoute("/verify")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Confirm your email code — flnt" },
      {
        name: "description",
        content: "Enter the 6-digit code flnt emailed you to confirm your account or sign-in.",
      },
      { property: "og:title", content: "Confirm your flnt code" },
      { property: "og:description", content: "Six digits stand between you and your flnt account." },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { purpose } = Route.useSearch();
  const navigate = useNavigate();
  const { signedIn, refresh } = useSession();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await verifyEmailCode({ data: { purpose, code: code.trim() } });
      await refresh();
      toast.success("Confirmed. Welcome back.");
      navigate({ to: "/updates" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That code didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    try {
      const result = await requestEmailCode({ data: { purpose } });
      toast[result.sent ? "success" : "warning"](
        result.sent ? "A new code is on its way." : "Couldn't send a new code right now.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send a new code.");
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-3xl font-bold">
          {purpose === "signup" ? "Verify your email" : "Confirm this sign-in"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {purpose === "signup"
            ? "We emailed a 6-digit code to the address you signed up with."
            : "For your security we email a fresh 6-digit code on every sign-in."}
        </p>

        {!signedIn ? (
          <p className="mt-8 rounded-md border border-border bg-secondary/40 p-4 text-sm">
            You're signed out. Sign in first, then come back with your code.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">6-digit code</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-[0.5em]"
                placeholder="000000"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
              {busy ? "Checking…" : "Confirm code"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={resend}>
              Send a new code
            </Button>
          </form>
        )}
      </div>
    </Shell>
  );
}
