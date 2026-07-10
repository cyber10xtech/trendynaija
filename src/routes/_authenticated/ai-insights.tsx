import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Zap, AlertTriangle, GitBranch, Network, TrendingUp, Brain, RefreshCw, Send, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Widget } from "@/components/widget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import {
  getBrainOverview, listAlerts, listNarratives, listEmergingTopics,
  listPredictions, listTopEntities, listTopicRelations, aiSearch,
} from "@/lib/ai/brain.functions";
import { runBrainNow } from "@/lib/ai/brain.admin.functions";

export const Route = createFileRoute("/_authenticated/ai-insights")({
  head: () => ({
    meta: [
      { title: "AI Intelligence — Trendy Naija" },
      { name: "description", content: "AI-powered trend brain: explanations, alerts, narratives, entity graph and predictions." },
    ],
  }),
  component: AIIntelligencePage,
});

const stateColors: Record<string, string> = {
  emerging: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  growing: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  trending: "bg-primary/15 text-primary",
  peak: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  declining: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  dormant: "bg-muted text-muted-foreground",
};

const alertSeverity: Record<string, string> = {
  high: "border-l-4 border-red-500",
  medium: "border-l-4 border-amber-500",
  low: "border-l-4 border-blue-500",
  info: "border-l-4 border-muted",
};

function AIIntelligencePage() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(getBrainOverview);
  const alertsFn = useServerFn(listAlerts);
  const narrativesFn = useServerFn(listNarratives);
  const emergingFn = useServerFn(listEmergingTopics);
  const predictionsFn = useServerFn(listPredictions);
  const entitiesFn = useServerFn(listTopEntities);
  const relationsFn = useServerFn(listTopicRelations);
  const searchFn = useServerFn(aiSearch);
  const runFn = useServerFn(runBrainNow);

  const overview = useQuery({ queryKey: ["brain-overview"], queryFn: () => overviewFn() });
  const alerts = useQuery({ queryKey: ["brain-alerts"], queryFn: () => alertsFn({ data: { limit: 10 } }) });
  const narratives = useQuery({ queryKey: ["brain-narratives"], queryFn: () => narrativesFn({ data: { limit: 8 } }) });
  const emerging = useQuery({ queryKey: ["brain-emerging"], queryFn: () => emergingFn({ data: { limit: 10 } }) });
  const predictions = useQuery({ queryKey: ["brain-predictions"], queryFn: () => predictionsFn({ data: { limit: 8 } }) });
  const entities = useQuery({ queryKey: ["brain-entities"], queryFn: () => entitiesFn({ data: { limit: 20 } }) });
  const relations = useQuery({ queryKey: ["brain-relations"], queryFn: () => relationsFn({ data: { limit: 12 } }) });

  const run = useMutation({
    mutationFn: () => runFn({ data: { skipBriefs: false, skipPredictions: false, skipNarratives: false } }),
    onSuccess: (r) => {
      toast.success("Brain run complete", {
        description: `${r.velocitiesUpdated} topics · ${r.alerts.fired} alerts · ${r.narratives.narrativesCreated + r.narratives.narrativesUpdated} narratives · ${r.briefs.generated} briefs`,
      });
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Brain run failed", { description: e.message }),
  });

  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<{ answer: string; citations: Array<{ label: string }>; confidence: number; usedEvidence: boolean } | null>(null);
  const search = useMutation({
    mutationFn: (question: string) => searchFn({ data: { question } }),
    onSuccess: (r) => setAnswer(r),
    onError: (e: Error) => toast.error("Search failed", { description: e.message }),
  });

  const stats = overview.data;

  return (
    <PageShell
      title="AI Intelligence"
      description="The Trend Brain — grounded explanations, alerts, narratives and predictions."
      actions={
        <Button size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${run.isPending ? "animate-spin" : ""}`} /> Run brain
        </Button>
      }
    >
      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Emerging", value: stats?.emergingCount ?? 0, icon: Zap },
          { label: "Trending", value: stats?.trendingCount ?? 0, icon: TrendingUp },
          { label: "Alerts 24h", value: stats?.alertsLast24h ?? 0, icon: AlertTriangle },
          { label: "Narratives", value: stats?.narrativesActive ?? 0, icon: GitBranch },
          { label: "Predictions", value: stats?.predictionsFresh ?? 0, icon: Brain },
          { label: "Briefs today", value: stats?.briefsToday ?? 0, icon: Sparkles },
          { label: "AI jobs 24h", value: stats?.aiJobsLast24h ?? 0, icon: Network },
        ].map((s) => (
          <div key={s.label} className="card-surface p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
              <s.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-semibold leading-tight">{s.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Search */}
      <Widget title="AI Search" subtitle="Ask a question grounded in stored intelligence">
        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); if (q.trim()) search.mutate(q.trim()); }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Why is Fuel Price trending? What happened in Imo today?" />
          <Button type="submit" size="sm" disabled={search.isPending || !q.trim()}>
            <Send className="w-3.5 h-3.5 mr-1.5" /> Ask
          </Button>
        </form>
        {answer && (
          <div className="mt-4 p-4 rounded-lg bg-muted/40 border border-border/60">
            <div className="text-sm whitespace-pre-wrap">{answer.answer}</div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {answer.citations.map((c, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">{c.label}</Badge>
              ))}
              <Badge variant="outline" className="text-[10px] ml-auto">
                confidence · {(answer.confidence * 100).toFixed(0)}%
              </Badge>
            </div>
          </div>
        )}
      </Widget>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Alerts */}
        <Widget title="Live alerts" subtitle="Breaking, exploding, and spike detection" className="lg:col-span-2">
          {alerts.data && alerts.data.length > 0 ? (
            <ul className="space-y-2">
              {alerts.data.map((a) => (
                <li key={a.id} className={`p-3 rounded-md bg-muted/30 ${alertSeverity[a.severity] ?? ""}`}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">{a.alert_type}</Badge>
                    <span className="text-sm font-medium truncate">{a.title}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(a.fired_at))} ago
                    </span>
                  </div>
                  {a.message && <p className="text-xs text-muted-foreground mt-1">{a.message}</p>}
                  {a.topics && (
                    <Link to="/topics/$slug" params={{ slug: a.topics.slug }}
                      className="text-[11px] text-primary hover:underline mt-1 inline-block">
                      → {a.topics.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<AlertTriangle className="w-5 h-5 text-muted-foreground" />}
              title="No alerts yet" description="Alerts appear as trends emerge and spike." />
          )}
        </Widget>

        {/* Emerging trends */}
        <Widget title="Emerging trends" subtitle="Highest momentum right now">
          {emerging.data && emerging.data.length > 0 ? (
            <ul className="space-y-2">
              {emerging.data.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <Badge className={`text-[10px] px-1.5 py-0 ${stateColors[t.lifecycle_state] ?? ""}`}>
                    {t.lifecycle_state}
                  </Badge>
                  <Link to="/topics/$slug" params={{ slug: t.slug }}
                    className="text-sm truncate hover:text-primary">{t.name}</Link>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    v {Number(t.velocity).toFixed(3)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Zap className="w-5 h-5 text-muted-foreground" />} title="No emerging trends yet" />
          )}
        </Widget>

        {/* Narratives */}
        <Widget title="Narratives" subtitle="Recurring story arcs across sources" className="lg:col-span-2">
          {narratives.data && narratives.data.length > 0 ? (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {narratives.data.map((n) => (
                <li key={n.id} className="p-3 rounded-md bg-muted/30">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-3.5 h-3.5 text-primary" />
                    <span className="text-sm font-medium truncate">{n.title}</span>
                    <Badge variant="outline" className="text-[10px] ml-auto">{n.lifecycle_state}</Badge>
                  </div>
                  {n.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.description}</p>}
                  <div className="text-[10px] text-muted-foreground mt-1.5">
                    {n.topic_count} topics · confidence {(Number(n.confidence) * 100).toFixed(0)}%
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<GitBranch className="w-5 h-5 text-muted-foreground" />}
              title="No narratives yet"
              description="Narratives form once topic relationships strengthen across ingestions." />
          )}
        </Widget>

        {/* Predictions */}
        <Widget title="Predictions" subtitle="Experimental · AI estimates">
          {predictions.data && predictions.data.length > 0 ? (
            <ul className="space-y-2">
              {predictions.data.map((p) => (
                <li key={p.id} className="p-2.5 rounded-md bg-muted/30">
                  {p.topics ? (
                    <Link to="/topics/$slug" params={{ slug: p.topics.slug }}
                      className="text-sm font-medium hover:text-primary">{p.topics.name}</Link>
                  ) : <span className="text-sm">unknown</span>}
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>growth {(Number(p.probability) * 100).toFixed(0)}%</span>
                    <span>·</span>
                    <span>{p.expected_lifespan_hours ?? "?"}h</span>
                    {p.national_spread_probability != null && (
                      <>
                        <span>·</span>
                        <span>national {(Number(p.national_spread_probability) * 100).toFixed(0)}%</span>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Brain className="w-5 h-5 text-muted-foreground" />} title="No predictions yet" />
          )}
        </Widget>

        {/* Topic graph */}
        <Widget title="Topic relationships" subtitle="Most strongly linked pairs" className="lg:col-span-2">
          {relations.data && relations.data.length > 0 ? (
            <ul className="space-y-1.5">
              {relations.data.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm">
                  <span className="truncate">{r.a?.name ?? "?"}</span>
                  <span className="text-muted-foreground">↔</span>
                  <span className="truncate">{r.b?.name ?? "?"}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    strength {Number(r.strength).toFixed(2)} · {r.evidence_count} obs
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Network className="w-5 h-5 text-muted-foreground" />}
              title="No topic relationships yet"
              description="Relations aggregate as AI summaries reference multiple topics." />
          )}
        </Widget>

        {/* Entities */}
        <Widget title="Top entities" subtitle="People, organizations, places">
          {entities.data && entities.data.length > 0 ? (
            <ul className="space-y-1.5">
              {entities.data.map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <Users className="w-3 h-3 text-muted-foreground" />
                  <span className="truncate">{e.name}</span>
                  <Badge variant="outline" className="text-[9px] py-0 h-4">{e.entity_type}</Badge>
                  <span className="text-[10px] text-muted-foreground ml-auto">{e.mention_count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Users className="w-5 h-5 text-muted-foreground" />}
              title="No entities extracted yet" />
          )}
        </Widget>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        <Link to="/daily-brief" className="hover:text-primary">View today's daily brief →</Link>
      </div>
    </PageShell>
  );
}
