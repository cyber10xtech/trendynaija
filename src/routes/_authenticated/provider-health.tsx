import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Widget } from "@/components/widget";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/provider-health")({
  head: () => ({ meta: [{ title: "Provider Health — Trendy Naija" }, { name: "description", content: "Live status of every ingestion provider." }] }),
  component: ProviderHealthPage,
});

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  healthy: "default",
  degraded: "secondary",
  down: "destructive",
  unknown: "secondary",
  disabled: "secondary",
};

function ProviderHealthPage() {
  const { data } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sources")
        .select("id, key, name, kind, status, enabled, last_sync_at, last_error, retry_count")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <PageShell title="Provider Health" description="Live status and last-sync timestamps for every provider.">
      <Widget title="Registered providers">
        {!data || data.length === 0 ? (
          <EmptyState
            icon={<Activity className="w-5 h-5 text-muted-foreground" />}
            title="No providers registered"
            description="Register a provider in Settings → Provider Configuration to see its health here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {data.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.kind} · last sync {s.last_sync_at ?? "never"} · retries {s.retry_count}
                  </div>
                  {s.last_error && <div className="text-xs text-destructive mt-1">{s.last_error}</div>}
                </div>
                <Badge variant={statusVariant[s.status] ?? "secondary"} className="rounded-full">
                  {s.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Widget>
    </PageShell>
  );
}
