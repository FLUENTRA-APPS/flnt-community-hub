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
          "Enter the 6-digit code flnt emailed you to confirm your account or sign-in.",
      },
      { property: "og:title", content: "Confirm your flnt code" },
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

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const cleanEmail = email.trim();
    const cleanCode = code.trim();

    if (!cleanEmail) {
      toast.error("Please enter your email address.");
      return;
    }

    if (cleanCode.length !== 6) {
      toast.error("Please enter the 6-digit code.");
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: purpose === "signup" ? "signup" : "email",
      });

      if (error) {
        throw error;
      }

      toast.success(
        purpose === "signup"
          ? "Email confirmed. Welcome to FLNT!"
          : "Sign-in confirmed. Welcome back!",
      );

      navigate({ to: "/updates" });
    } catch (error) {
      console.error("OTP verification error:", error);

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
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      toast.error("Please enter your email address first.");
      return;
    }

    setResending(true);

    try {
      const { error } = await supabase.auth.resend({
        type: purpose === "signup" ? "signup" : "email",
        email: cleanEmail,
      });

      if (error) {
        throw error;
      }

      toast.success("A new verification code has been sent.");
    } catch (error) {
      console.error("OTP resend error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't send a new verification code.",
      );
    } finally {
      setResending(false);
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
              pattern="[0-9]{6}"
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
            disabled={
              busy ||
              code.length !== 6 ||
              email.trim().length === 0
            }
          >
            {busy ? "Checking…" : "Confirm code"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={resend}
            disabled={resending || email.trim().length === 0}
          >
            {resending ? "Sending…" : "Send a new code"}
          </Button>
        </form>
      </div>
    </Shell>
  );
}
