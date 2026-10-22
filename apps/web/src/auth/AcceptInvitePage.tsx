import { useMutation, useQuery } from "@tanstack/react-query";
import { ROLE_LABELS, isRole } from "api/src/auth/roles";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { signIn } from "@/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc";
import { AuthShell } from "./AuthShell";

const STATUS_TEXT = {
  expired: "This invitation has expired. Ask an admin for a new link.",
  used: "This invitation has already been used. Sign in instead.",
  unknown: "This invitation link is not valid.",
} as const;

/** /invite/:token — set a name and password, then sign in with them. */
export function AcceptInvitePage() {
  const { token = "" } = useParams();
  const trpc = useTRPC();
  const invite = useQuery(trpc.invite.get.queryOptions({ token }));

  if (invite.isPending) {
    return (
      <AuthShell title="Accept invitation">
        <Skeleton className="h-32" />
      </AuthShell>
    );
  }
  if (invite.error || invite.data.status !== "valid" || !invite.data.email) {
    const status = invite.data?.status ?? "unknown";
    const text = status === "valid" ? STATUS_TEXT.unknown : STATUS_TEXT[status];
    return (
      <AuthShell title="Accept invitation">
        <p className="text-sm text-muted-foreground">{invite.error?.message ?? text}</p>
        <Button variant="outline" className="mt-4" render={<Link to="/login" />}>
          Go to sign in
        </Button>
      </AuthShell>
    );
  }
  return <AcceptForm token={token} email={invite.data.email} initialName={invite.data.name ?? ""} role={invite.data.role} />;
}

function AcceptForm({ token, email, initialName, role }: { token: string; email: string; initialName: string; role: string | null }) {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const accept = useMutation(trpc.invite.accept.mutationOptions());
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      await accept.mutateAsync({ token, name, password });
      const { error } = await signIn.email({ email, password });
      if (error) {
        setError(`Account created, but sign in failed: ${error.message ?? "unknown error"}.`);
        return;
      }
      navigate("/walk", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept the invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Accept invitation"
      description={
        <>
          You have been invited as <strong>{isRole(role) ? ROLE_LABELS[role] : role}</strong>. Set a password for{" "}
          <strong>{email}</strong>.
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">At least 10 characters.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
