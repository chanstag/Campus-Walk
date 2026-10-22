import { Icons } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppNav } from "./AppNav";

/**
 * Layout every page uses: brand + nav in the sidebar, an optional page-specific
 * sidebar slot below the nav (the walk tree), and a header with breadcrumbs.
 */
export function PageShell({
  sidebar,
  crumbs = [],
  placeholder = "Campus Walk",
  children,
}: {
  sidebar?: React.ReactNode;
  crumbs?: string[];
  placeholder?: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      {/* Four tree levels need more than the 16rem default. */}
      <SidebarProvider style={{ "--sidebar-width": "19rem" } as React.CSSProperties}>
        <Sidebar>
          <SidebarHeader className="flex-row items-center gap-2 px-4 py-3">
            <Icons.walk className="size-5" />
            <span className="font-semibold">Campus Walk</span>
          </SidebarHeader>
          <SidebarContent>
            <AppNav />
            {sidebar && (
              <>
                <SidebarSeparator />
                {sidebar}
              </>
            )}
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="min-h-svh">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
            <nav aria-label="Location" className="flex min-w-0 items-center gap-1 text-sm">
              {crumbs.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
              {crumbs.map((c, i) => (
                <span key={i} className="flex min-w-0 items-center gap-1">
                  {i > 0 && <Icons.ui.chevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
                  <span className={i === crumbs.length - 1 ? "truncate font-medium" : "truncate text-muted-foreground"}>
                    {c}
                  </span>
                </span>
              ))}
            </nav>
            <ThemeToggle className="ml-auto" />
            <UserMenu />
          </header>

          <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
