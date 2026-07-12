import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, TrendingUp, Newspaper, Hash, Sparkles, MapPin,
  Settings, Activity, Tags, LogOut, Flame, FileText, GitCompare, Globe,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/trending", label: "Trending", icon: TrendingUp },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/topics", label: "Topics", icon: Tags },
  { to: "/hashtags", label: "Hashtags", icon: Hash },
  { to: "/ai-insights", label: "AI Intelligence", icon: Sparkles },
  { to: "/daily-brief", label: "Daily Brief", icon: FileText },
  { to: "/regions", label: "Regions", icon: Globe },
  { to: "/compare", label: "Compare", icon: GitCompare },
  { to: "/states", label: "States", icon: MapPin },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/provider-health", label: "Provider Health", icon: Activity },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
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

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
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

      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/auth";
          }}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
