import { isAdmin } from "api/src/auth/roles";
import { NavLink, useLocation } from "react-router";
import { useSession } from "@/auth-client";
import { Icons, type LucideIcon } from "@/components/icons";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const LINKS: { to: string; label: string; icon: LucideIcon; devOnly?: boolean; adminOnly?: boolean }[] = [
  { to: "/walk", label: "Walk", icon: Icons.walk },
  { to: "/office", label: "Office", icon: Icons.assessment },
  { to: "/users", label: "Users", icon: Icons.ui.users, adminOnly: true },
  { to: "/design", label: "Design", icon: Icons.ui.settings, devOnly: true },
];

/** Top-level navigation shared by every page; the current page's link is highlighted. */
export function AppNav() {
  const { pathname } = useLocation();
  const { data: session } = useSession();
  const admin = isAdmin(session?.user.role);
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {LINKS.filter((l) => (!l.devOnly || import.meta.env.DEV) && (!l.adminOnly || admin)).map(({ to, label, icon: Icon }) => (
            <SidebarMenuItem key={to}>
              <SidebarMenuButton
                render={<NavLink to={to} />}
                isActive={pathname === to || pathname.startsWith(`${to}/`)}
              >
                <Icon />
                <span>{label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
