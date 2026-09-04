import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

// Minimal local typing for the beta supabase.auth.oauth namespace.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Authorize access — Lensly";
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md glass rounded-3xl p-6 md:p-8 space-y-5">{children}</div>
    </main>
  );

  if (error)
    return shell(
      <>
        <h1 className="font-display text-xl">Could not load this authorization request</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
      </>,
    );
  if (!details) return shell(<p className="text-sm text-muted-foreground">Loading…</p>);

  const clientName = details.client?.name ?? "an app";
  const scopes: string[] = String(details.scope ?? "").split(" ").filter(Boolean);

  return shell(
    <>
      <h1 className="font-display text-xl">Connect {clientName} to Lensly</h1>
      <p className="text-sm text-muted-foreground">
        {clientName} will be able to call Lensly's photo analysis tools while you are signed in.
      </p>
      {details.client?.redirect_uri && (
        <p className="font-mono text-xs text-muted-foreground break-all">
          Redirects to {details.client.redirect_uri}
        </p>
      )}
      {scopes.length > 0 && (
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          {scopes.map((s) => (
            <li key={s}>
              {s === "profile"
                ? "Share your basic profile"
                : s === "email"
                  ? "Share your email address"
                  : s === "openid"
                    ? "Confirm your identity"
                    : `Additional permission requested: ${s}`}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        This does not bypass Lensly's permissions or backend policies.
      </p>
      <div className="flex gap-3">
        <Button disabled={busy} onClick={() => decide(true)} className="flex-1">
          Approve
        </Button>
        <Button disabled={busy} variant="secondary" onClick={() => decide(false)} className="flex-1">
          Cancel connection
        </Button>
      </div>
    </>,
  );
};

export default OAuthConsent;