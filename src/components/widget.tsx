import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-10 px-6 rounded-xl border border-dashed border-border bg-muted/30",
        className,
      )}
    >
      <div className="w-11 h-11 rounded-full bg-background border border-border flex items-center justify-center mb-3 shadow-sm">
        {icon ?? <Inbox className="w-5 h-5 text-muted-foreground" />}
      </div>
      <div className="text-sm font-medium text-foreground">{title}</div>
      {description && (
        <div className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</div>
      )}
    </div>
  );
}

interface WidgetProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Widget({ title, subtitle, action, children, className }: WidgetProps) {
  return (
    <section className={cn("card-surface p-5", className)}>
      <header className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
