import { useQueryClient } from "@tanstack/react-query";
import { ROLE_LABELS, isAdmin, isRole } from "api/src/auth/roles";
import { useNavigate } from "react-router";
import { signOut, useSession } from "@/auth-client";
import { Icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Header account menu: who is signed in, their role, Users (admins), sign out. */
export function UserMenu() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  if (!session) return null;

  const { user } = session;
  const role = user.role ?? "";

  async function handleSignOut() {
    await signOut();
    // Drop every cached query so the next person on this device starts clean.
    qc.clear();
    navigate("/login", { replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Account menu" />}>
        <Icons.ui.user />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="flex flex-col gap-1 font-normal">
          <span className="font-medium">{user.name}</span>
          <span className="text-xs text-muted-foreground">{user.email}</span>
          <Badge variant="secondary" className="mt-1 w-fit">
            {isRole(role) ? ROLE_LABELS[role] : role || "No role"}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin(role) && (
          <DropdownMenuItem onClick={() => navigate("/users")}>
            <Icons.ui.users />
            Users
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleSignOut}>
          <Icons.ui.signOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
