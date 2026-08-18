import {
  LayoutDashboard, TrendingUp, Newspaper, Hash, Sparkles, MapPin,
  Settings, Activity, Tags, FileText, GitCompare, Globe, MessageSquare,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/hooks/use-auth";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Roles allowed to see this entry. Omitted = everyone signed in. */
  roles?: AppRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/trending", label: "Trending", icon: TrendingUp },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/topics", label: "Topics", icon: Tags },
  { to: "/hashtags", label: "Hashtags", icon: Hash },
  { to: "/copilot", label: "AI Copilot", icon: MessageSquare },
  { to: "/ai-insights", label: "AI Intelligence", icon: Sparkles },
  { to: "/daily-brief", label: "Daily Brief", icon: FileText },
  { to: "/regions", label: "Regions", icon: Globe },
  { to: "/compare", label: "Compare", icon: GitCompare },
  { to: "/states", label: "States", icon: MapPin },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["admin", "analyst"] },
  { to: "/provider-health", label: "Provider Health", icon: Activity, roles: ["admin", "analyst"] },
];

export function visibleNavItems(role: AppRole | null): NavItem[] {
  return NAV_ITEMS.filter((i) => !i.roles || (role ? i.roles.includes(role) : false));
}
