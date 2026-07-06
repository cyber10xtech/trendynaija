import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";

interface PageShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({ title, description, actions, children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="md:pl-64">
        <header className="sticky top-0 z-10 bg-background/85 backdrop-blur-xl border-b border-border">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
              {description && (
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              )}
            </div>
            {actions}
          </div>
        </header>
        <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8">{children}</main>
      </div>
    </div>
  );
}
