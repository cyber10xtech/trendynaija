import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Widget } from "@/components/widget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { getStateOverview } from "@/lib/regional/regional.functions";
import { generateStateInsightNow } from "@/lib/regional/regional.admin.functions";

export const Route = createFileRoute("/_authenticated/state/$id")({
  head: () => ({ meta: [{ title: "State — Trendy Naija" }, { name: "description", content: "State-level trend intelligence." }] }),
  component: StatePage,
});

type Window = "24h" | "7d" | "30d" | "90d";

function StatePage() {
  const { id } = Route.useParams();
  const [win, setWin] = useState<Window>("24h");
  const overviewFn = useServerFn(getStateOverview);
  const insightFn = useServerFn(generateStateInsightNow);
  const [insight, setInsight] = useState<{ summary?: string; keyPoints?: string[] } | null>(null);

  const overview = useQuery({
    queryKey: ["state-overview", id, win],
    queryFn: () => overviewFn({ data: { stateId: id, window: win } }),
  });

  const genInsight = useMutation({
    mutationFn: () => insightFn({ data: { stateId: id } }),
    onSuccess: (r) => {
      if (r.ok) setInsight({ summary: r.summary, keyPoints: r.keyPoints });
      else toast.error("AI insight failed", { description: r.error });
    },
    onError: (e: Error) => toast.error("AI insight failed", { description: e.message }),
  });

  const s = overview.data?.state;

  return (
    <PageShell
      title={s?.name ?? "State"}
      description={s ? `${s.region ?? ""} · Capital: ${s.capital ?? "—"}` : "Loading…"}
      actions={
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-muted/40 rounded-md p-0.5">
            {(["24h", "7d", "30d", "90d"] as Window[]).map((w) => (
              <button key={w} onClick={() => setWin(w)} className={`px-2 py-1 text-xs rounded ${win === w ? "bg-background shadow" : ""}`}>{w}</button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => genInsight.mutate()} disabled={genInsight.isPending}>
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> AI insight
          </Button>
        </div>
      }
    >
      {insight && (
        <Widget title="AI insight" className="mb-5">
          <p className="text-sm">{insight.summary}</p>
          {insight.keyPoints && (
            <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground space-y-1">
              {insight.keyPoints.map((k, i) => <li key={i}>{k}</li>)}
            </ul>
          )}
        </Widget>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Widget title="Top topics" subtitle={win}>
          {overview.data?.topTopics && overview.data.topTopics.length > 0 ? (
            <ul className="divide-y divide-border">
              {overview.data.topTopics.map((t) => (
                <li key={t.topic_id} className="py-2 flex items-center justify-between">
                  <div className="min-w-0">
                    {t.topic ? (
                      <Link to="/topics/$slug" params={{ slug: t.topic.slug }} className="text-sm font-medium hover:text-primary">{t.topic.name}</Link>
                    ) : <span className="text-sm">(unlabelled)</span>}
                    <div className="text-[10px] text-muted-foreground">news {t.news_count} · social {t.social_count}</div>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{t.trend_score.toFixed(2)}</Badge>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No topic activity in this window" />}
        </Widget>

        <Widget title="Latest news">
          {overview.data?.news && overview.data.news.length > 0 ? (
            <ul className="divide-y divide-border">
              {overview.data.news.map((n) => (
                <li key={n.id} className="py-2">
                  <Link to="/news/$id" params={{ id: n.id }} className="text-sm font-medium hover:text-primary line-clamp-2">{n.title}</Link>
                  <div className="text-[10px] text-muted-foreground">{n.sources?.name ?? "source"} · {formatDistanceToNow(new Date(n.published_at))} ago</div>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No news in this window" />}
        </Widget>

        <Widget title="Social signals">
          {overview.data?.signals && overview.data.signals.length > 0 ? (
            <ul className="divide-y divide-border">
              {overview.data.signals.map((sig) => (
                <li key={sig.id} className="py-2">
                  <div className="text-sm line-clamp-2">{sig.text}</div>
                  <div className="text-[10px] text-muted-foreground">{sig.sources?.name ?? ""} · {formatDistanceToNow(new Date(sig.published_at))} ago</div>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No social signals in this window" />}
        </Widget>

        <Widget title="Alerts">
          {overview.data?.alerts && overview.data.alerts.length > 0 ? (
            <ul className="space-y-2">
              {overview.data.alerts.map((a) => (
                <li key={a.id} className="p-2 rounded-md bg-muted/30">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-[10px] text-muted-foreground">{a.alert_type}</div>
                </li>
              ))}

            </ul>
          ) : <EmptyState title="No alerts" />}
        </Widget>
      </div>
    </PageShell>
  );
}
