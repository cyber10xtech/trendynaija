import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, Flame, RefreshCw, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Widget } from "@/components/widget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import {
  listTrendingSearches,
  risingSearches,
  listTrendRegions,
} from "@/lib/trends/trends.functions";
import { syncGoogleTrends } from "@/lib/trends/trends.admin.functions";

export const Route = createFileRoute("/_authenticated/trending")({
  head: () => ({ meta: [{ title: "Trending — Trendy Naija" }, { name: "description", content: "Live Google Trends for Nigeria and Imo State." }] }),
  component: TrendingPage,
});

function TrendingPage() {
  const qc = useQueryClient();
  const [region, setRegion] = useState<string>("NG");
  const regionsFn = useServerFn(listTrendRegions);
  const trendingFn = useServerFn(listTrendingSearches);
  const risingFn = useServerFn(risingSearches);
  const syncFn = useServerFn(syncGoogleTrends);

  const regions = useQuery({ queryKey: ["trend-regions"], queryFn: () => regionsFn() });
  const trending = useQuery({
    queryKey: ["trending-searches", region],
    queryFn: () => trendingFn({ data: { regionCode: region, limit: 30, window: "24h" } }),
  });
  const rising = useQuery({
    queryKey: ["rising-searches", region],
    queryFn: () => risingFn({ data: { regionCode: region, limit: 10 } }),
  });

  const sync = useMutation({
    mutationFn: () => syncFn({ data: { regionCode: region, deep: false } }),
    onSuccess: (r) => {
      const first = r.reports?.[0];
      toast.success(`Synced ${region}`, {
        description: first ? `${first.fetched} fetched · ${first.inserted} stored · ${first.topicsCreated} new topics` : "Done",
      });
      qc.invalidateQueries({ queryKey: ["trending-searches"] });
      qc.invalidateQueries({ queryKey: ["rising-searches"] });
      qc.invalidateQueries({ queryKey: ["trends-stats"] });
    },
    onError: (e: Error) => toast.error("Sync failed", { description: e.message }),
  });

  return (
    <PageShell
      title="Trending"
      description="Live Google Trends. Nigeria and Imo State supported today; more states coming."
      actions={
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-muted/40 rounded-md p-0.5">
            {(regions.data ?? []).map((r) => (
              <button
                key={r.geo_code}
                onClick={() => setRegion(r.geo_code)}
                className={`px-2.5 py-1 text-xs rounded ${region === r.geo_code ? "bg-background shadow" : "hover:bg-background/40"}`}
              >
                {r.name}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${sync.isPending ? "animate-spin" : ""}`} /> Sync now
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Widget title="Trending searches" subtitle={`Last 24 hours · ${region}`} className="lg:col-span-2">
          {trending.data && trending.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {trending.data.map((t, idx) => (
                <li key={t.id} className="py-3 flex items-start gap-3 group">
                  <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center text-xs font-semibold flex-shrink-0">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    {t.topics ? (
                      <Link to="/topics/$slug" params={{ slug: t.topics.slug }} className="text-sm font-medium hover:text-primary transition-colors">
                        {t.keyword}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium">{t.keyword}</span>
                    )}
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      {t.traffic && <Badge variant="outline" className="h-4 py-0 text-[10px]">{t.traffic} searches</Badge>}
                      <span>{formatDistanceToNow(new Date(t.snapshot_at))} ago</span>
                      {t.trend_regions && <span>· {t.trend_regions.name}</span>}
                    </div>
                    {t.articles && t.articles.length > 0 && (
                      <a href={t.articles[0].url} target="_blank" rel="noreferrer" className="block text-xs text-muted-foreground hover:text-primary mt-1 truncate">
                        📰 {t.articles[0].title}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<TrendingUp className="w-5 h-5 text-muted-foreground" />}
              title="No trending searches yet"
              description={sync.isPending ? "Fetching from Google…" : "Click Sync now to pull the latest trends from Google."}
            />
          )}
        </Widget>

        <Widget title="Rising fast" subtitle="Last 6 hours">
          {rising.data && rising.data.length > 0 ? (
            <ul className="space-y-2">
              {rising.data.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <Flame className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  {r.topics ? (
                    <Link to="/topics/$slug" params={{ slug: r.topics.slug }} className="text-sm truncate hover:text-primary">
                      {r.keyword}
                    </Link>
                  ) : (
                    <span className="text-sm truncate">{r.keyword}</span>
                  )}
                  {r.traffic && <span className="text-[10px] text-muted-foreground ml-auto">{r.traffic}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Zap className="w-5 h-5 text-muted-foreground" />} title="No rising searches" description="Populates after two ingestion cycles." />
          )}
        </Widget>

        <Widget title="AI trend summary" className="lg:col-span-3">
          <EmptyState
            icon={<Sparkles className="w-5 h-5 text-muted-foreground" />}
            title="AI overview populates after enrichment"
            description="Run a deep sync from Provider Health to fetch interest-over-time, related queries and related topics."
          />
        </Widget>
      </div>
    </PageShell>
  );
}
