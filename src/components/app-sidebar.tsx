import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, Flame, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { visibleNavItems } from "@/components/nav-items";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-6 h-16 border-b border-sidebar-border">
      <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center shadow-lg">
        <Flame className="w-5 h-5 text-sidebar-primary-foreground" />
      </div>
      <div>
        <div className="font-semibold tracking-tight text-[15px]">Trendy Naija</div>
        <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">
          Trend Intelligence
        </div>
      </div>
    </div>
  );
}

async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/auth";
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { role } = useAuth();

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {visibleNavItems(role).map(({ to, label, icon: Icon }) => {
        const active = pathname === to || pathname.startsWith(to + "/");
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-lg text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SignOutButton() {
  return (
    <div className="p-3 border-t border-sidebar-border">
      <button
        onClick={signOut}
        className="flex w-full items-center gap-3 px-3 py-3 md:py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <Brand />
      <NavList />
      <SignOutButton />
    </aside>
  );
}

/** Slide-out navigation for small screens. Reuses the desktop nav definitions. */
export function MobileNav({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  // Close after navigation.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open navigation"
        className={cn(
          "md:hidden inline-flex items-center justify-center h-10 w-10 -ml-2 rounded-lg text-foreground hover:bg-muted transition-colors",
          className,
        )}
      >
        <Menu className="w-5 h-5" />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[17rem] p-0 bg-sidebar text-sidebar-foreground border-sidebar-border flex flex-col [&>button]:text-sidebar-foreground/70"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <SheetTitle className="sr-only">Trendy Naija navigation</SheetTitle>
        <Brand />
        <NavList onNavigate={() => setOpen(false)} />
        <SignOutButton />
      </SheetContent>
    </Sheet>
  );
}
