import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Widget } from "@/components/widget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listRegionsSummary, listRegionAlerts } from "@/lib/regional/regional.functions";
import { runRegionalIntelNow } from "@/lib/regional/regional.admin.functions";

export const Route = createFileRoute("/_authenticated/regions")({
  head: () => ({ meta: [
    { title: "Regions — Trendy Naija" },
    { name: "description", content: "Geographic intelligence across Nigeria: what's trending state by state." },
  ]}),
  component: RegionsPage,
});

function RegionsPage() {
  const listFn = useServerFn(listRegionsSummary);
  const alertsFn = useServerFn(listRegionAlerts);
  const runFn = useServerFn(runRegionalIntelNow);
  const regions = useQuery({ queryKey: ["regions-summary"], queryFn: () => listFn() });
  const alerts = useQuery({ queryKey: ["region-alerts"], queryFn: () => alertsFn({ data: {} }) });
  const run = useMutation({
    mutationFn: () => runFn(),
    onSuccess: (r) => {
      toast.success("Regional sweep complete", {
        description: `${r.aggregation.regionRowsWritten} regional rows · ${r.alerts.fired} alerts`,
      });
      regions.refetch();
      alerts.refetch();
    },
    onError: (e: Error) => toast.error("Sweep failed", { description: e.message }),
  });

  const sorted = [...(regions.data ?? [])].sort((a, b) => (b.stats?.trend_score ?? 0) - (a.stats?.trend_score ?? 0));

  return (
    <PageShell
      title="Regions"
      description="Where the conversation is happening. Every stat is grounded in real news, search and social evidence."
      actions={
        <Button size="sm" variant="outline" onClick={() => run.mutate()} disabled={run.isPending}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${run.isPending ? "animate-spin" : ""}`} /> Run sweep
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Widget title="States" className="lg:col-span-2">
          {sorted.length === 0 ? (
            <EmptyState icon={<MapPin className="w-5 h-5 text-muted-foreground" />} title="No regional stats yet" description="Run a sweep to aggregate signals into regional statistics." />
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sorted.map((s) => (
                <li key={s.id}>
                  <Link
                    to="/state/$id"
                    params={{ id: s.id }}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/30 hover:bg-muted/60 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {s.region ?? ""} · {s.stats ? `${s.stats.signal_count} signals` : "no data"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.stats && <Badge variant="secondary" className="text-[10px]">score {s.stats.trend_score.toFixed(2)}</Badge>}
                      {s.is_active && <Badge variant="default" className="text-[10px]">Active</Badge>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget title="Regional alerts" subtitle="Cross-state spread, spikes, migrations">
          {alerts.data && alerts.data.length > 0 ? (
            <ul className="space-y-2">
              {alerts.data.slice(0, 10).map((a) => (
                <li key={a.id} className="p-2 rounded-md bg-muted/30">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {a.alert_type} · {a.severity}
                  </div>
                </li>
              ))}

            </ul>
          ) : (
            <EmptyState icon={<TrendingUp className="w-5 h-5 text-muted-foreground" />} title="No alerts" description="Alerts appear when regional patterns are detected." />
          )}
        </Widget>
      </div>
    </PageShell>
  );
}
