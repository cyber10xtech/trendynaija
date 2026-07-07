import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, RefreshCw, Power, Sparkles, RotateCcw } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Widget } from "@/components/widget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listProvidersHealth, listProviderLogs } from "@/lib/news/news.functions";
import {
  syncProvider,
  toggleProvider,
  retryFailedJobs,
  summarizeNow,
} from "@/lib/news/news.admin.functions";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

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
  const qc = useQueryClient();
  const providersFn = useServerFn(listProvidersHealth);
  const logsFn = useServerFn(listProviderLogs);
  const syncFn = useServerFn(syncProvider);
  const toggleFn = useServerFn(toggleProvider);
  const retryFn = useServerFn(retryFailedJobs);
  const summarizeFn = useServerFn(summarizeNow);

  const providers = useQuery({ queryKey: ["providers-health"], queryFn: () => providersFn() });
  const logs = useQuery({ queryKey: ["provider-logs"], queryFn: () => logsFn({ data: { limit: 20 } }) });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["providers-health"] });
    qc.invalidateQueries({ queryKey: ["provider-logs"] });
    qc.invalidateQueries({ queryKey: ["latest-clusters"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const sync = useMutation({
    mutationFn: (sourceKey: string) => syncFn({ data: { sourceKey } }),
    onSuccess: (r, key) => {
      const first = r.reports?.[0];
      toast.success(`Synced ${key}`, {
        description: first ? `${first.inserted} new · ${first.duplicates} dupes · ${first.clustersCreated} clusters` : "Done",
      });
      invalidate();
    },
    onError: (e: Error) => toast.error("Sync failed", { description: e.message }),
  });

  const toggle = useMutation({
    mutationFn: (args: { sourceId: string; enabled: boolean }) => toggleFn({ data: args }),
    onSuccess: () => { toast.success("Updated"); invalidate(); },
    onError: (e: Error) => toast.error("Update failed", { description: e.message }),
  });

  const retry = useMutation({
    mutationFn: () => retryFn(),
    onSuccess: (r) => { toast.success(`Retried ${r.retried} providers`); invalidate(); },
    onError: (e: Error) => toast.error("Retry failed", { description: e.message }),
  });

  const summarize = useMutation({
    mutationFn: () => summarizeFn(),
    onSuccess: (r) => { toast.success(`Summarized ${r.summarized} clusters`); invalidate(); },
    onError: (e: Error) => toast.error("AI summary failed", { description: e.message }),
  });

  return (
    <PageShell
      title="Provider Health"
      description="Live status and last-sync timestamps for every provider."
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => summarize.mutate()} disabled={summarize.isPending}>
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Summarize
          </Button>
          <Button size="sm" variant="outline" onClick={() => retry.mutate()} disabled={retry.isPending}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Retry failed
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Widget title="Registered providers">
          {!providers.data || providers.data.length === 0 ? (
            <EmptyState icon={<Activity className="w-5 h-5 text-muted-foreground" />} title="No providers registered" />
          ) : (
            <ul className="divide-y divide-border">
              {providers.data.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{s.name}</span>
                      <Badge variant={statusVariant[s.status] ?? "secondary"} className="rounded-full">
                        {s.status}
                      </Badge>
                      {!s.enabled && <Badge variant="outline">disabled</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-x-2">
                      <span>{s.kind}</span>
                      <span>· last sync {s.last_sync_at ? formatDistanceToNow(new Date(s.last_sync_at)) + " ago" : "never"}</span>
                      <span>· retries {s.retry_count}</span>
                      <span>· failures {s.failureCount}</span>
                      {s.lastJob && (
                        <span>· last pull {s.lastJob.itemsIngested} articles{s.lastJob.latencyMs ? ` in ${s.lastJob.latencyMs}ms` : ""}</span>
                      )}
                    </div>
                    {s.last_error && <div className="text-xs text-destructive mt-1 truncate">{s.last_error}</div>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sync.mutate(s.key)}
                      disabled={sync.isPending || !s.enabled}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${sync.isPending && sync.variables === s.key ? "animate-spin" : ""}`} />
                      Sync
                    </Button>
                    <Button
                      size="sm"
                      variant={s.enabled ? "outline" : "default"}
                      onClick={() => toggle.mutate({ sourceId: s.id, enabled: !s.enabled })}
                      disabled={toggle.isPending}
                    >
                      <Power className="w-3.5 h-3.5 mr-1.5" />
                      {s.enabled ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget title="Recent logs">
          {logs.data && logs.data.length > 0 ? (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {logs.data.map((l) => {
                const src = Array.isArray(l.sources) ? l.sources[0] : l.sources;
                return (
                  <li key={l.id} className="text-xs flex gap-2 items-start p-2 rounded-md bg-muted/30">
                    <Badge variant={l.level === "error" ? "destructive" : l.level === "warn" ? "secondary" : "outline"} className="text-[10px] uppercase">{l.level}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground">{src?.name ?? "system"}: {l.message}</div>
                      <div className="text-muted-foreground text-[10px]">{formatDistanceToNow(new Date(l.created_at))} ago</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="No logs yet" description="Logs appear as providers run." />
          )}
        </Widget>
      </div>
    </PageShell>
  );
}
