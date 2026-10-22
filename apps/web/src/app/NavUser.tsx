import { useQueryClient } from "@tanstack/react-query";
import { ROLE_LABELS, isRole } from "api/src/auth/roles";
import { useNavigate } from "react-router";
import { signOut, useSession } from "@/auth-client";
import { Icons } from "@/components/icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

function initials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0]![0]! + parts[parts.length - 1]![0]! : (parts[0] ?? email).slice(0, 2);
  return letters.toUpperCase();
}

/** Sidebar footer: who is signed in, with a popup for profile details and sign out. */
export function NavUser() {
  const { data: session, isPending } = useSession();
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const qc = useQueryClient();

  if (isPending) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Skeleton className="h-12 w-full" />
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }
  if (!session) return null;

  const { user } = session;
  const role = user.role ?? "";
  const roleLabel = isRole(role) ? ROLE_LABELS[role] : role || "No role";

  async function handleSignOut() {
    await signOut();
    // Drop every cached query so the next person on this device starts clean.
    qc.clear();
    navigate("/login", { replace: true });
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground" />}
          >
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg">{initials(user.name, user.email)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
            <Icons.ui.expand className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">{initials(user.name, user.email)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
              <div className="px-1 pb-1.5">
                <Badge variant="secondary">{roleLabel}</Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <Icons.ui.signOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
