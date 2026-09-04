import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

function safeNext(value: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

/** Public same-origin OAuth landing route: waits for the session, then forwards. */
const AuthCallback = () => {
  useEffect(() => {
    const next = safeNext(new URLSearchParams(window.location.search).get("next"));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) window.location.replace(next);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-surface grid place-items-center text-sm text-muted-foreground">
      Signing you in…
    </div>
  );
};

export default AuthCallback;