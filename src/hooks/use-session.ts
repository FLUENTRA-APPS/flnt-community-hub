import { useQuery, useQueryClient } from "@tanstack/react-query";
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

  const query = useQuery({
    queryKey: ["session"],
    staleTime: 15_000,
    retry: false,
    queryFn: () => getSessionState(),
  });

  const session = query.data ?? null;

  return {
    loading: query.isLoading,
    signedIn: Boolean(session),
    session,
    ready: Boolean(session?.emailVerified && session?.mfaOk),
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  };
}
