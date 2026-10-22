import { NavLink, useLocation } from "react-router";
import { Icons, type LucideIcon } from "@/components/icons";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const LINKS: { to: string; label: string; icon: LucideIcon; devOnly?: boolean }[] = [
  { to: "/walk", label: "Walk", icon: Icons.walk },
  { to: "/office", label: "Office", icon: Icons.assessment },
  { to: "/design", label: "Design", icon: Icons.ui.settings, devOnly: true },
];

/** Top-level navigation shared by every page; the current page's link is highlighted. */
export function AppNav() {
  const { pathname } = useLocation();
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {LINKS.filter((l) => !l.devOnly || import.meta.env.DEV).map(({ to, label, icon: Icon }) => (
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
