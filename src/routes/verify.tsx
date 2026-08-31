import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
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
        content:
          "Enter the 6-digit code flnt emailed you to confirm your account.",
      },
      { property: "og:title", content: "Confirm your flnt code" },
      {
        property: "og:description",
        content: "Enter the 6-digit code sent to your email.",
      },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { purpose } = Route.useSearch();
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (code.length !== 6) {
      toast.error("Enter the 6-digit code.");
      return;
    }

    if (!email.trim()) {
      toast.error("Enter the email address you used to create your account.");
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "signup",
      });

      if (error) throw error;

      toast.success("Email confirmed. Welcome to FLNT.");
      navigate({ to: "/updates" });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "That verification code didn't work.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!email.trim()) {
      toast.error("Enter your email address first.");
      return;
    }

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
      });

      if (error) throw error;

      toast.success("A new verification code is on its way.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't send a new code.",
      );
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-3xl font-bold">
          {purpose === "signup"
            ? "Verify your email"
            : "Confirm your sign-in"}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Enter the 6-digit code sent to your email address.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

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
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, ""))
              }
              className="text-center text-2xl tracking-[0.5em]"
              placeholder="000000"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={busy || code.length !== 6 || !email.trim()}
          >
            {busy ? "Checking…" : "Confirm code"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={resend}
            disabled={!email.trim()}
          >
            Send a new code
          </Button>
        </form>
      </div>
    </Shell>
  );
}
