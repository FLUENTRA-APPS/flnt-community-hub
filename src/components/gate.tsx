import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function Notice({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{action}</CardContent>
      </Card>
    </div>
  );
}

/** Renders children only for a signed-in, email-verified, code-confirmed account. */
export function AccountGate({ children }: { children: ReactNode }) {
  const { loading, signedIn, session, ready } = useSession();

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted-foreground">Loading…</div>
    );
  }

  if (!signedIn) {
    return (
      <Notice
        title="Sign in to continue"
        description="This part of flnt is for members. Create an account or sign in — it takes a minute."
        action={
          <Button asChild>
            <Link to="/auth">Go to sign in</Link>
          </Button>
        }
      />
    );
  }

  if (!session?.emailVerified) {
    return (
      <Notice
        title="Verify your email address"
        description="We emailed you a 6-digit code when you signed up. Enter it to unlock member features."
        action={
          <Button asChild>
            <Link to="/verify" search={{ purpose: "signup" }}>
              Enter verification code
            </Link>
          </Button>
        }
      />
    );
  }

  if (!ready) {
    return (
      <Notice
        title="Confirm this sign-in"
        description="For every login we email a fresh 6-digit confirmation code. Enter it to continue."
        action={
          <Button asChild>
            <Link to="/verify" search={{ purpose: "login" }}>
              Enter login code
            </Link>
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
