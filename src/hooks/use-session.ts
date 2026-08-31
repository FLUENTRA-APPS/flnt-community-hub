import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSessionState, type SessionState } from "@/lib/auth.functions";

export type UseSession = {
  loading: boolean;
  signedIn: boolean;
  session: SessionState | null;
  /** Signed in, email verified and login confirmed with a fresh email code. */
  ready: boolean;
  refresh: () => void;
};

export function useSession(): UseSession {
  const queryClient = useQueryClient();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      queryClient.invalidateQueries({ queryKey: ["session"] });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const query = useQuery({
    queryKey: ["session"],
    enabled: signedIn === true,
    staleTime: 15_000,
    retry: false,
    queryFn: () => getSessionState(),
  });

  const session = signedIn ? (query.data ?? null) : null;

  return {
    loading: signedIn === null || (signedIn === true && query.isLoading),
    signedIn: signedIn === true,
    session,
    ready: Boolean(session?.emailVerified && session?.mfaOk),
    refresh: () => queryClient.invalidateQueries({ queryKey: ["session"] }),
  };
}
