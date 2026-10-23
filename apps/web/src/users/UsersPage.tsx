import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ROLE_LABELS, ROLES, type Role, isRole } from "api/src/auth/roles";
import type { RouterOutputs } from "api/src/router";
import { useState } from "react";
import { PageShell } from "@/app/PageShell";
import { useSession } from "@/auth-client";
import { useCan } from "@/auth/permissions";
import { Icons } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTRPC } from "@/trpc";

type UserRow = RouterOutputs["users"]["list"]["users"][number];
type InvitationRow = RouterOutputs["users"]["list"]["invitations"][number];
type InviteLink = { email: string; url: string };

/** Admin page: invite people (copyable link), manage users and pending invitations. */
export function UsersPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const myId = session?.user.id;
  const { can: canInvite } = useCan("user", "invite");
  const { can: canUpdate } = useCan("user", "update");
  const { can: canDelete } = useCan("user", "delete");

  const list = useQuery(trpc.users.list.queryOptions());
  const invalidate = () => qc.invalidateQueries(trpc.users.list.pathFilter());

  const [link, setLink] = useState<InviteLink | null>(null);
  const [passwordFor, setPasswordFor] = useState<UserRow | null>(null);
  const [removing, setRemoving] = useState<UserRow | null>(null);

  const invite = useMutation(
    trpc.users.invite.mutationOptions({
      onSuccess: (r, vars) => {
        setLink({ email: vars.email, url: r.url });
        invalidate();
      },
    }),
  );
  const regenerate = useMutation(trpc.users.regenerateLink.mutationOptions({ onSuccess: () => invalidate() }));
  const revoke = useMutation(trpc.users.revokeInvitation.mutationOptions({ onSuccess: () => invalidate() }));
  const setRole = useMutation(trpc.users.setRole.mutationOptions({ onSuccess: () => invalidate() }));
  const ban = useMutation(trpc.users.ban.mutationOptions({ onSuccess: () => invalidate() }));
  const unban = useMutation(trpc.users.unban.mutationOptions({ onSuccess: () => invalidate() }));
  const remove = useMutation(trpc.users.remove.mutationOptions({ onSuccess: () => invalidate() }));

  const actionError = [setRole, ban, unban, remove, regenerate, revoke].find((m) => m.error)?.error?.message;

  return (
    <PageShell crumbs={["Users"]} placeholder="Users">
      <div className="flex max-w-5xl flex-col gap-8">
        {canInvite && (
          <InviteCard pending={invite.isPending} error={invite.error?.message} onInvite={(v) => invite.mutate(v)} />
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Users</h2>
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          {list.isPending && <Skeleton className="h-32" />}
          {list.error && <p className="text-sm text-destructive">{list.error.message}</p>}
          {list.data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.users.map((u) => {
                  const me = u.id === myId;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.name}
                        {me && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <RoleSelect
                          value={u.role}
                          disabled={me || !canUpdate || setRole.isPending}
                          onChange={(role) => setRole.mutate({ userId: u.id, role })}
                        />
                      </TableCell>
                      <TableCell>
                        {u.banned ? (
                          <Badge variant="destructive" title={u.banReason ?? undefined}>
                            Banned
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {(canUpdate || canDelete) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.name}`} disabled={me} />}
                            >
                              <Icons.ui.more />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canUpdate && (
                                <DropdownMenuItem onClick={() => setPasswordFor(u)}>
                                  <Icons.ui.password />
                                  Set temporary password
                                </DropdownMenuItem>
                              )}
                              {canUpdate &&
                                (u.banned ? (
                                  <DropdownMenuItem onClick={() => unban.mutate({ userId: u.id })}>
                                    <Icons.ui.confirm />
                                    Unban
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => ban.mutate({ userId: u.id })}>
                                    <Icons.ui.ban />
                                    Ban
                                  </DropdownMenuItem>
                                ))}
                              {canUpdate && canDelete && <DropdownMenuSeparator />}
                              {canDelete && (
                                <DropdownMenuItem variant="destructive" onClick={() => setRemoving(u)}>
                                  <Icons.ui.delete />
                                  Remove
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Pending invitations</h2>
          {list.data && list.data.invitations.length === 0 && (
            <p className="text-sm text-muted-foreground">No pending invitations.</p>
          )}
          {list.data && list.data.invitations.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.invitations.map((inv: InvitationRow) => {
                  const expired = inv.expiresAt.getTime() < Date.now();
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell className="text-muted-foreground">{inv.name ?? "—"}</TableCell>
                      <TableCell>{isRole(inv.role) ? ROLE_LABELS[inv.role] : inv.role}</TableCell>
                      <TableCell>
                        {expired ? <Badge variant="destructive">Expired</Badge> : inv.expiresAt.toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {canInvite && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${inv.email}`} />}
                          >
                            <Icons.ui.more />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                regenerate.mutate(
                                  { invitationId: inv.id },
                                  { onSuccess: (r) => setLink({ email: inv.email, url: r.url }) },
                                )
                              }
                            >
                              <Icons.ui.copy />
                              Copy new link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => revoke.mutate({ invitationId: inv.id })}>
                              <Icons.ui.delete />
                              Revoke
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </div>

      <LinkDialog link={link} onClose={() => setLink(null)} />
      <PasswordDialog user={passwordFor} onClose={() => setPasswordFor(null)} />
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their account and sessions are deleted. Assessments they recorded are kept. To block someone temporarily, ban
              them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (removing) remove.mutate({ userId: removing.id });
                setRemoving(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

function RoleSelect({ value, disabled, onChange }: { value: string | null; disabled?: boolean; onChange: (r: Role) => void }) {
  const current = isRole(value) ? value : null;
  return (
    <Select value={current} onValueChange={(v) => isRole(v) && v !== current && onChange(v)} items={ROLE_LABELS} disabled={disabled}>
      <SelectTrigger size="sm" className="w-28" aria-label="Role">
        <SelectValue placeholder={value ?? "—"} />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function InviteCard({
  pending,
  error,
  onInvite,
}: {
  pending: boolean;
  error?: string;
  onInvite: (v: { email: string; name?: string; role: Role }) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("field");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onInvite({ email, name: name || undefined, role });
    setEmail("");
    setName("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite someone</CardTitle>
        <CardDescription>
          Creates a link that is valid for 7 days. Copy it and send it to them yourself; the app does not email it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <div className="grid gap-2">
            <Label htmlFor="inv-email">Email</Label>
            <Input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inv-name">Name (optional)</Label>
            <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inv-role">Role</Label>
            <Select value={role} onValueChange={(v) => isRole(v) && setRole(v)} items={ROLE_LABELS}>
              <SelectTrigger id="inv-role" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending}>
            <Icons.ui.add />
            Invite
          </Button>
          {error && <p className="text-sm text-destructive sm:col-span-4">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

function LinkDialog({ link, onClose }: { link: InviteLink | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (http, permissions); the input below is selectable.
    }
  }
  return (
    <Dialog open={!!link} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitation link</DialogTitle>
          <DialogDescription>
            Send this to <strong>{link?.email}</strong>. It works once and expires in 7 days. You can make a new one from
            the pending invitations list.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input readOnly value={link?.url ?? ""} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
          <Button variant="outline" onClick={copy}>
            {copied ? <Icons.ui.confirm /> : <Icons.ui.copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const trpc = useTRPC();
  const [password, setPassword] = useState("");
  const set = useMutation(trpc.users.setTemporaryPassword.mutationOptions());

  function close() {
    setPassword("");
    set.reset();
    onClose();
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    await set.mutateAsync({ userId: user.id, password });
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Temporary password for {user?.name}</DialogTitle>
            <DialogDescription>
              Replaces their current password. Tell them the new one yourself; they can keep it or you can set another
              later.
            </DialogDescription>
          </DialogHeader>
          {set.isSuccess ? (
            <p className="text-sm">Password updated.</p>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="tmp-pw">New password</Label>
              <Input
                id="tmp-pw"
                type="text"
                autoComplete="off"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">At least 10 characters.</p>
            </div>
          )}
          {set.error && <p className="text-sm text-destructive">{set.error.message}</p>}
          <DialogFooter>
            {set.isSuccess ? (
              <Button type="button" onClick={close}>
                Done
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" disabled={set.isPending}>
                  Set password
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
