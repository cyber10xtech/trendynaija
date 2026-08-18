import type { ReactNode } from "react";
import { AppSidebar, MobileNav } from "./app-sidebar";

interface PageShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageShell({ title, description, actions, children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <AppSidebar />
      <div className="md:pl-64">
        <header className="sticky top-0 z-10 bg-background/85 backdrop-blur-xl border-b border-border">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 min-h-16 py-3 flex items-center gap-3">
            <MobileNav />
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
                {title}
              </h1>
              {description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
              )}
            </div>
            {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
          </div>
        </header>
        <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
