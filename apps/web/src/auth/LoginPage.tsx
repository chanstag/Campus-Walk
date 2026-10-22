import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { signIn, useSession } from "@/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "./AuthShell";

export function LoginPage() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/walk";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in (e.g. pressed back): skip the form.
  useEffect(() => {
    if (session) navigate(from, { replace: true });
  }, [session, from, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signIn.email({ email, password });
    setBusy(false);
    if (error) setError(error.message ?? "Sign in failed.");
    else navigate(from, { replace: true });
  }

  return (
    <AuthShell title="Sign in" description="Campus Walk is invite-only. Use the password you set when you accepted your invitation.">
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-xs text-muted-foreground">Forgot your password? Ask an admin to set a temporary one.</p>
      </form>
    </AuthShell>
  );
}
