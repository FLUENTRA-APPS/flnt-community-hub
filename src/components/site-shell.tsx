import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/updates", label: "Updates" },
  { to: "/trust", label: "Trusted businesses" },
  { to: "/support", label: "Support" },
] as const;

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-xl font-bold tracking-tight", className)}>
      flnt<span className="text-primary">.</span>
    </span>
  );
}

export function SiteHeader() {
  const { session, signedIn } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center" aria-label="flnt home">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: "text-foreground bg-muted" }}
            >
              {item.label}
            </Link>
          ))}
          {session?.isAdmin ? (
            <Link
              to="/admin"
              className="rounded-md px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-accent"
            >
              Admin
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {signedIn ? (
            <>
              <span className="max-w-[14rem] truncate text-sm text-muted-foreground">
                {session?.displayName || session?.email}
              </span>
              <Button variant="outline" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/auth">Create account</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-md border border-border md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open ? (
        <div className="border-t border-border md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3" aria-label="Mobile">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
            {session?.isAdmin ? (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-accent"
              >
                Admin
              </Link>
            ) : null}
            {signedIn ? (
              <Button variant="outline" size="sm" className="mt-2" onClick={signOut}>
                Sign out
              </Button>
            ) : (
              <Button size="sm" className="mt-2" asChild>
                <Link to="/auth" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
              </Button>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Wordmark className="text-base" />
          <span>Community updates and business trust, in the open.</span>
        </div>
        <nav className="flex flex-wrap gap-4" aria-label="Footer">
          <Link to="/updates" className="hover:text-foreground">
            Updates
          </Link>
          <Link to="/trust" className="hover:text-foreground">
            Trusted businesses
          </Link>
          <Link to="/support" className="hover:text-foreground">
            Support
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-b border-border bg-secondary/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-12 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h1>
          {description ? <p className="mt-3 text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
