import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Six digits stand between you and your flnt account.",
      },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { purpose } = Route.useSearch();
  const navigate = useNavigate();
  const session = useSession();

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!session.loading && !session.signedIn) {
      navigate({ to: "/auth" });
    }
  }, [session.loading, session.signedIn, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length !== 6) {
      toast.error("Please enter the 6-digit code.");
      return;
    }
    setBusy(true);
    try {
      const result = await verifyEmailCode({ data: { purpose, code: code.trim() } });
      if (!result.ok) {
        toast.error(result.error ?? "That verification code didn't work.");
        return;
      }
      session.refresh();
      toast.success(
        purpose === "signup" ? "Email confirmed. Welcome to flnt!" : "Sign-in confirmed.",
      );
      navigate({ to: "/updates" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That code didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      const result = await requestEmailCode({ data: { purpose } });
      if (result.reason === "rate_limited") {
        toast.error("Too many codes requested. Try again in an hour.");
      } else if (!result.sent) {
        toast.error("Email delivery is not configured yet. Ask the site owner to set it up.");
      } else {
        toast.success("A new code is on its way to your inbox.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send a new code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-3xl font-bold">
          {purpose === "signup" ? "Verify your email" : "Confirm your sign-in"}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Enter the 6-digit code we sent to{" "}
          <span className="font-medium text-foreground">
            {session.session?.email ?? "your email address"}
          </span>
          .
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">6-digit code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
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

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={resend}
            disabled={resending}
          >
            {resending ? "Sending…" : "Send a new code"}
          </Button>
        </form>
      </div>
    </Shell>
  );
}
