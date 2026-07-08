import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, MessageSquare, Layers, Newspaper, Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Widget } from "@/components/widget";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { getTopicDetail } from "@/lib/trends/trends.functions";

export const Route = createFileRoute("/_authenticated/topics/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Trendy Naija` },
      { name: "description", content: `Trend intelligence for ${params.slug}: interest over time, related queries, related topics, and news coverage.` },
    ],
  }),
  component: TopicDetailPage,
  errorComponent: ({ reset }) => {
    const router = useRouter();
    return (
      <PageShell title="Topic error">
        <Widget title="Something went wrong">
          <button className="text-sm text-primary" onClick={() => { reset(); router.invalidate(); }}>Retry</button>
        </Widget>
      </PageShell>
    );
  },
  notFoundComponent: () => (
    <PageShell title="Topic not found">
      <Widget title="Unknown topic"><EmptyState title="This topic doesn't exist yet." /></Widget>
    </PageShell>
  ),
});

function sparklinePath(points: Array<{ ts: string; value: number }>, w = 600, h = 80): string {
  if (points.length === 0) return "";
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const step = w / Math.max(points.length - 1, 1);
  return points.map((p, i) => {
    const x = i * step;
    const y = h - ((p.value - min) / (max - min || 1)) * h;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function TopicDetailPage() {
  const { slug } = Route.useParams();
  const fetchFn = useServerFn(getTopicDetail);
  const q = useQuery({
    queryKey: ["topic-detail", slug],
    queryFn: async () => {
      const r = await fetchFn({ data: { slug } });
      if (!r) throw notFound();
      return r;
    },
  });

  if (q.isLoading || !q.data) {
    return <PageShell title="Loading…"><Widget title="Loading topic"><div className="text-sm text-muted-foreground">Fetching intelligence…</div></Widget></PageShell>;
  }

  const d = q.data;
  const iotByRegion = new Map<string, typeof d.interestOverTime>();
  for (const p of d.interestOverTime) {
    const key = p.trend_regions?.geo_code ?? p.region_id;
    if (!iotByRegion.has(key)) iotByRegion.set(key, []);
    iotByRegion.get(key)!.push(p);
  }

  const risingQueries = d.relatedQueries.filter((r) => r.query_type === "rising" || r.query_type === "breakout");
  const topQueries = d.relatedQueries.filter((r) => r.query_type === "top");

  return (
    <PageShell
      title={d.topic.name}
      description={`Trend intelligence for "${d.topic.name}"`}
      actions={
        <div className="flex items-center gap-2">
          {d.topic.category && <Badge variant="outline">{d.topic.category}</Badge>}
          {d.trendScore && (
            <Badge className="rounded-full">Score {d.trendScore.score.toFixed(1)}</Badge>
          )}
          {d.trendScore && (
            <Badge variant="secondary" className="rounded-full">Confidence {Math.round((d.trendScore.confidence || 0) * 100)}%</Badge>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Widget title="Interest over time" subtitle="Google Trends, per region" className="lg:col-span-2">
          {d.interestOverTime.length > 0 ? (
            <div className="space-y-4">
              {Array.from(iotByRegion.entries()).map(([code, pts]) => (
                <div key={code}>
                  <div className="text-xs text-muted-foreground mb-1">{pts[0]?.trend_regions?.name ?? code}</div>
                  <svg viewBox="0 0 600 80" className="w-full h-16 text-primary">
                    <path d={sparklinePath(pts)} fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<TrendingUp className="w-5 h-5 text-muted-foreground" />}
              title="No interest data yet"
              description="Run a deep sync from Provider Health to pull interest-over-time from Google."
            />
          )}
        </Widget>

        <Widget title="Trend signals" subtitle="Weighted score components">
          {d.trendScore ? (
            <ul className="space-y-2 text-xs">
              {[
                ["Search interest", d.trendScore.search_interest],
                ["News coverage", d.trendScore.news_coverage],
                ["Mention volume", d.trendScore.mention_volume],
                ["Growth velocity", d.trendScore.growth_velocity],
                ["Source diversity", d.trendScore.source_diversity],
                ["Freshness", d.trendScore.freshness],
              ].map(([label, val]) => (
                <li key={label as string} className="flex justify-between items-center">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="tabular-nums">{Number(val).toFixed(1)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No score yet" />
          )}
        </Widget>

        <Widget title="Rising queries" subtitle="Breakout & rising related searches">
          {risingQueries.length > 0 ? (
            <ul className="space-y-1.5">
              {risingQueries.slice(0, 20).map((r, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span className="truncate">{r.query}</span>
                  <Badge variant={r.query_type === "breakout" ? "default" : "secondary"} className="text-[10px] h-4">{r.query_type}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<MessageSquare className="w-5 h-5 text-muted-foreground" />} title="No rising queries" />
          )}
        </Widget>

        <Widget title="Top related queries">
          {topQueries.length > 0 ? (
            <ul className="space-y-1.5">
              {topQueries.slice(0, 20).map((r, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span className="truncate">{r.query}</span>
                  {r.value !== null && <span className="text-xs text-muted-foreground tabular-nums">{r.value}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No related queries" />
          )}
        </Widget>

        <Widget title="Related topics">
          {d.relatedTopics.length > 0 ? (
            <ul className="space-y-1.5">
              {d.relatedTopics.slice(0, 20).map((r, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span className="truncate">{r.related_name}</span>
                  <span className="text-[10px] text-muted-foreground">{r.relation_kind}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Layers className="w-5 h-5 text-muted-foreground" />} title="No related topics" />
          )}
        </Widget>

        <Widget title="News coverage" subtitle="Articles surfaced with this trend" className="lg:col-span-3">
          {d.snapshots.some((s) => s.articles?.length) ? (
            <ul className="divide-y divide-border">
              {d.snapshots.flatMap((s) => s.articles).slice(0, 20).map((a, i) => (
                <li key={i} className="py-2">
                  <a href={a.url} target="_blank" rel="noreferrer" className="block hover:text-primary">
                    <div className="text-sm">{a.title}</div>
                    <div className="text-[11px] text-muted-foreground">{a.source}</div>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Newspaper className="w-5 h-5 text-muted-foreground" />} title="No news articles attached" />
          )}
        </Widget>

        <Widget title="AI summary" subtitle="Cross-signal narrative" className="lg:col-span-3">
          <EmptyState
            icon={<Sparkles className="w-5 h-5 text-muted-foreground" />}
            title="AI summary populates after enrichment"
            description={`Last updated ${formatDistanceToNow(new Date(d.topic.updated_at))} ago`}
          />
        </Widget>
      </div>
    </PageShell>
  );
}
