import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, Newspaper, Sparkles, Tags, Activity, Zap, Search, Flame } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Widget, EmptyState } from "@/components/widget";
import { Badge } from "@/components/ui/badge";
import {
  dashboardStats,
  listLatestClusters,
  listProvidersHealth,
} from "@/lib/news/news.functions";
import { listTrendingSearches, trendsDashboardStats } from "@/lib/trends/trends.functions";
import { listTrendingHashtags, socialStats } from "@/lib/social/social.functions";
import { Hash } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Trendy Naija" },
      { name: "description", content: "Live view of what Nigeria is talking about, starting with Imo State." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const statsFn = useServerFn(dashboardStats);
  const clustersFn = useServerFn(listLatestClusters);
  const providersFn = useServerFn(listProvidersHealth);
  const trendingFn = useServerFn(listTrendingSearches);
  const trendsStatsFn = useServerFn(trendsDashboardStats);

  const hashtagsFn = useServerFn(listTrendingHashtags);
  const socialStatsFn = useServerFn(socialStats);

  const stats = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => statsFn() });
  const trends = useQuery({ queryKey: ["trends-stats"], queryFn: () => trendsStatsFn() });
  const hashtags = useQuery({ queryKey: ["dash-hashtags"], queryFn: () => hashtagsFn({ data: { limit: 10 } }) });
  const social = useQuery({ queryKey: ["dash-social-stats"], queryFn: () => socialStatsFn() });
  const trendingNG = useQuery({ queryKey: ["dash-trending", "NG"], queryFn: () => trendingFn({ data: { regionCode: "NG", limit: 8 } }) });
  const trendingIM = useQuery({ queryKey: ["dash-trending", "NG-IM"], queryFn: () => trendingFn({ data: { regionCode: "NG-IM", limit: 8 } }) });
  const clusters = useQuery({
    queryKey: ["latest-clusters", 6],
    queryFn: () => clustersFn({ data: { limit: 6 } }),
  });
  const providers = useQuery({ queryKey: ["providers-health"], queryFn: () => providersFn() });

  const breaking = stats.data?.breakingCluster;

  return (
    <PageShell
      title="Dashboard"
      description="Discover what Nigeria is talking about — starting with Imo State."
      actions={<Badge variant="secondary" className="rounded-full">Imo State · Live</Badge>}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Widget title="Google Trends · Nigeria" subtitle={trends.data?.lastSyncAt ? `Last sync ${formatDistanceToNow(new Date(trends.data.lastSyncAt))} ago` : "Not synced yet"} action={<Link to="/trending" className="text-xs text-primary hover:underline">See all →</Link>}>
          {trendingNG.data && trendingNG.data.length > 0 ? (
            <ol className="space-y-1.5">
              {trendingNG.data.slice(0, 8).map((t, i) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <span className="w-4 text-muted-foreground text-xs tabular-nums">{i + 1}</span>
                  {t.topics ? (
                    <Link to="/topics/$slug" params={{ slug: t.topics.slug }} className="truncate hover:text-primary">{t.keyword}</Link>
                  ) : <span className="truncate">{t.keyword}</span>}
                  {t.traffic && <span className="ml-auto text-[10px] text-muted-foreground">{t.traffic}</span>}
                </li>
              ))}
            </ol>
          ) : <EmptyState icon={<Search className="w-5 h-5 text-muted-foreground" />} title="No Google Trends yet" description="Open Trending and click Sync now." />}
        </Widget>

        <Widget title="Google Trends · Imo" subtitle="State-level trending searches" action={<Link to="/trending" className="text-xs text-primary hover:underline">See all →</Link>}>
          {trendingIM.data && trendingIM.data.length > 0 ? (
            <ol className="space-y-1.5">
              {trendingIM.data.slice(0, 8).map((t, i) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <Flame className="w-3 h-3 text-primary flex-shrink-0" />
                  {t.topics ? (
                    <Link to="/topics/$slug" params={{ slug: t.topics.slug }} className="truncate hover:text-primary">{t.keyword}</Link>
                  ) : <span className="truncate">{t.keyword}</span>}
                </li>
              ))}
            </ol>
          ) : <EmptyState icon={<Search className="w-5 h-5 text-muted-foreground" />} title="Imo trends coming soon" description={`${trends.data?.activeRegions ?? 0} regions active`} />}
        </Widget>


        <Widget title="Breaking Story" subtitle="Highest-coverage cluster right now" className="lg:col-span-2">
          {breaking ? (
            <Link to="/news/cluster/$id" params={{ id: breaking.id }} className="block group">
              <div className="flex gap-4">
                {breaking.image_url && (
                  <img src={breaking.image_url} alt="" className="w-32 h-24 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground">{breaking.article_count} sources covering</span>
                  </div>
                  <h4 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {breaking.title}
                  </h4>
                  {breaking.summary && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{breaking.summary}</p>
                  )}
                </div>
              </div>
            </Link>
          ) : (
            <EmptyState icon={<TrendingUp className="w-5 h-5 text-muted-foreground" />} title="No breaking news yet" description="Trigger an ingestion sync to populate this." />
          )}
        </Widget>

        <Widget title="Coverage" subtitle="Since launch">
          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Articles</span>
              <span className="text-2xl font-semibold">{stats.data?.articles ?? 0}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Story clusters</span>
              <span className="text-2xl font-semibold">{stats.data?.clusters ?? 0}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Active sources</span>
              <span className="text-2xl font-semibold">{stats.data?.activeSources ?? 0}</span>
            </div>
          </div>
        </Widget>

        <Widget title="Trending Hashtags" subtitle={`${social.data?.signalsLast24h ?? 0} signals last 24h · ${social.data?.enabledProviders ?? 0} providers`} action={<Link to="/hashtags" className="text-xs text-primary hover:underline">See all →</Link>}>
          {hashtags.data && hashtags.data.length > 0 ? (
            <ol className="space-y-1.5">
              {hashtags.data.slice(0, 8).map((h) => (
                <li key={h.id} className="flex items-center gap-2 text-sm">
                  <span className="w-4 text-xs text-muted-foreground tabular-nums">{h.current_rank}</span>
                  <Link to="/hashtags" className="truncate hover:text-primary">#{h.tag}</Link>
                  <span className="ml-auto text-[10px] text-muted-foreground">{h.usage_count}</span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState icon={<Hash className="w-5 h-5 text-muted-foreground" />} title="No hashtags yet" description="Ingest social sources to populate hashtags." />
          )}
        </Widget>



        <Widget title="Latest Stories" subtitle="Deduplicated & clustered" className="lg:col-span-2" action={<Link to="/news" className="text-xs text-primary hover:underline">See all →</Link>}>
          {clusters.data && clusters.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {clusters.data.map((c) => (
                <li key={c.id}>
                  <Link to="/news/cluster/$id" params={{ id: c.id }} className="flex items-start gap-3 py-3 group">
                    {c.image_url && <img src={c.image_url} alt="" className="w-16 h-16 rounded-md object-cover flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {c.category && <Badge variant="outline" className="text-[10px] py-0 h-4">{c.category}</Badge>}
                        <span className="text-[11px] text-muted-foreground">{c.article_count} sources</span>
                        {c.last_seen_at && <span className="text-[11px] text-muted-foreground">· {formatDistanceToNow(new Date(c.last_seen_at))} ago</span>}
                      </div>
                      <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">{c.title}</div>
                      {c.summary && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.summary}</div>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Newspaper className="w-5 h-5 text-muted-foreground" />} title="No news ingested yet" description="Open Provider Health and click Sync on any source." />
          )}
        </Widget>

        <Widget title="AI Summary" subtitle="Breaking story digest">
          {breaking?.summary ? (
            <div className="text-sm text-foreground/90 leading-relaxed">{breaking.summary}</div>
          ) : (
            <EmptyState icon={<Sparkles className="w-5 h-5 text-muted-foreground" />} title="Waiting for AI" description="Summaries generate automatically after each ingestion sweep." />
          )}
        </Widget>

        <Widget title="News Categories" subtitle="Distribution across articles">
          {stats.data && stats.data.categories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {stats.data.categories.slice(0, 12).map((c) => (
                <Link key={c.name} to="/news" search={{ category: c.name } as never} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs hover:bg-muted/70">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">{c.count}</span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Tags className="w-5 h-5 text-muted-foreground" />} title="No categories yet" />
          )}
        </Widget>

        <Widget title="Provider Health" className="lg:col-span-2" action={<Link to="/provider-health" className="text-xs text-primary hover:underline">Manage →</Link>}>
          {providers.data && providers.data.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {providers.data.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground">{p.last_sync_at ? `synced ${formatDistanceToNow(new Date(p.last_sync_at))} ago` : "never synced"}</div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${p.status === "healthy" ? "bg-emerald-500" : p.status === "down" ? "bg-destructive" : "bg-muted-foreground/50"}`} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Activity className="w-5 h-5 text-muted-foreground" />} title="No providers registered" />
          )}
        </Widget>
      </div>
    </PageShell>
  );
}
