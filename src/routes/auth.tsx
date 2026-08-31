import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or create your flnt account" },
      {
        name: "description",
        content:
          "Create a flnt account or sign in. Every account is confirmed with a 6-digit code sent to your email address.",
      },
      { property: "og:title", content: "Sign in to flnt" },
      {
        property: "og:description",
        content: "Verified members vote on updates and review businesses on flnt.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-3xl font-bold">Welcome to flnt</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Accounts are confirmed by email. We send a 6-digit code when you sign up, and a fresh one
          every time you sign in.
        </p>

        <Tabs defaultValue="signin" className="mt-8">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <AuthForm mode="signin" />
          </TabsContent>
          <TabsContent value="signup">
            <AuthForm mode="signup" />
          </TabsContent>
        </Tabs>

        <Card className="mt-8 border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Administrators</CardTitle>
            <CardDescription>
              The flnt admin account is granted by allowlisted email address on first sign-in. The
              owner of that address must set their own credentials through this normal sign-up flow
              (or a secure password reset) — nobody can set or read that password for them, and it is
              never stored in the app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={() => toast.info("Use the Create account tab with your admin email, then confirm the emailed code.")}>
              How admin access works
            </Button>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }

   if (mode === "signup") {
  toast.success("Check your inbox for your 6-digit verification code.");
  navigate({
    to: "/verify",
    search: { purpose: "signup" },
  });
  return;
}

toast.success("Signed in successfully.");
navigate({ to: "/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${mode}-email`}>Email address</Label>
        <Input
          id={`${mode}-email`}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${mode}-password`}>Password</Label>
        <Input
          id={`${mode}-password`}
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Already have a code waiting?{" "}
        <Link
          to="/verify"
          search={{ purpose: mode === "signup" ? "signup" : "login" }}
          className="text-primary hover:underline"
        >
          Enter it here
        </Link>
        .
      </p>
    </form>
  );
}
