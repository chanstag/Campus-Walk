import type { PermissionKey } from "api/src/auth/permission-catalog";
import { NavLink, useLocation } from "react-router";
import { hasPermission, usePermissions } from "@/auth/permissions";
import { Icons, type LucideIcon } from "@/components/icons";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const LINKS: { to: string; label: string; icon: LucideIcon; devOnly?: boolean; permission?: PermissionKey }[] = [
  { to: "/walk", label: "Walk", icon: Icons.walk, permission: "campus:read" },
  { to: "/office", label: "Office", icon: Icons.assessment, permission: "summary:read" },
  { to: "/users", label: "Users", icon: Icons.ui.users, permission: "user:read" },
  { to: "/permissions", label: "Permissions", icon: Icons.ui.permissions, permission: "permission:read" },
  { to: "/design", label: "Design", icon: Icons.ui.settings, devOnly: true },
];

/** Top-level navigation shared by every page; links the user cannot open are hidden. */
export function AppNav() {
  const { pathname } = useLocation();
  const { data: permissions } = usePermissions();
  const visible = LINKS.filter(
    (l) => (!l.devOnly || import.meta.env.DEV) && (!l.permission || hasPermission(permissions, l.permission)),
  );
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {visible.map(({ to, label, icon: Icon }) => (
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
