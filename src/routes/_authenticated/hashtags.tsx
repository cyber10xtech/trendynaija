import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Hash, TrendingUp, TrendingDown, Minus, MessagesSquare } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Widget } from "@/components/widget";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import {
  listTrendingHashtags,
  listRecentSocialSignals,
  socialSourceBreakdown,
  socialStats,
} from "@/lib/social/social.functions";

export const Route = createFileRoute("/_authenticated/hashtags")({
  head: () => ({
    meta: [
      { title: "Hashtags — Trendy Naija" },
      { name: "description", content: "Ranked trending hashtags from public social platforms across Nigeria." },
    ],
  }),
  component: HashtagsPage,
});

function RankArrow({ change }: { change: number }) {
  if (change > 0) return <span className="inline-flex items-center gap-0.5 text-emerald-500 text-[11px] tabular-nums"><TrendingUp className="w-3 h-3" />{change}</span>;
  if (change < 0) return <span className="inline-flex items-center gap-0.5 text-destructive text-[11px] tabular-nums"><TrendingDown className="w-3 h-3" />{Math.abs(change)}</span>;
  return <span className="inline-flex items-center gap-0.5 text-muted-foreground text-[11px]"><Minus className="w-3 h-3" /></span>;
}

function HashtagsPage() {
  const hashtagsFn = useServerFn(listTrendingHashtags);
  const signalsFn = useServerFn(listRecentSocialSignals);
  const sourcesFn = useServerFn(socialSourceBreakdown);
  const statsFn = useServerFn(socialStats);

  const hashtags = useQuery({ queryKey: ["hashtags-trending", 30], queryFn: () => hashtagsFn({ data: { limit: 30 } }) });
  const signals = useQuery({ queryKey: ["social-signals", "recent"], queryFn: () => signalsFn({ data: { limit: 20 } }) });
  const sources = useQuery({ queryKey: ["social-sources"], queryFn: () => sourcesFn() });
  const stats = useQuery({ queryKey: ["social-stats"], queryFn: () => statsFn() });

  return (
    <PageShell
      title="Hashtags"
      description="Ranked trending hashtags and public social conversations across Nigeria."
      actions={<Badge variant="secondary" className="rounded-full">Public sources</Badge>}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Widget title="Ranked hashtags">
          <div className="text-2xl font-semibold">{stats.data?.rankedHashtags ?? 0}</div>
        </Widget>
        <Widget title="Signals (24h)">
          <div className="text-2xl font-semibold">{stats.data?.signalsLast24h ?? 0}</div>
        </Widget>
        <Widget title="Total signals">
          <div className="text-2xl font-semibold">{stats.data?.totalSignals ?? 0}</div>
        </Widget>
        <Widget title="Active providers">
          <div className="text-2xl font-semibold">{stats.data?.enabledProviders ?? 0}</div>
        </Widget>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
        <Widget title="Top hashtags" subtitle="Ranked by public usage" className="lg:col-span-2">
          {hashtags.data && hashtags.data.length > 0 ? (
            <ol className="divide-y divide-border">
              {hashtags.data.map((h) => (
                <li key={h.id} className="py-2.5 flex items-center gap-3">
                  <span className="w-6 text-xs text-muted-foreground tabular-nums">{h.current_rank}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">#{h.tag}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {h.usage_count} mentions · velocity {Number(h.velocity ?? 0).toFixed(0)}
                      {h.last_seen_at && ` · last ${formatDistanceToNow(new Date(h.last_seen_at))} ago`}
                    </div>
                  </div>
                  <RankArrow change={h.rank_change ?? 0} />
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState icon={<Hash className="w-5 h-5 text-muted-foreground" />} title="No hashtags ranked yet" description="Trigger a social ingest to populate hashtags." />
          )}
        </Widget>

        <Widget title="Source distribution" subtitle="Signals last 7 days">
          {sources.data && sources.data.length > 0 ? (
            <ul className="space-y-1.5">
              {sources.data.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-sm">
                  <span className="truncate">{s.name}</span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">{s.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<MessagesSquare className="w-5 h-5 text-muted-foreground" />} title="No signals yet" />
          )}
        </Widget>

        <Widget title="Recent social signals" subtitle="Public posts from connected providers" className="lg:col-span-3">
          {signals.data && signals.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {signals.data.map((s) => {
                const src = Array.isArray(s.sources) ? s.sources[0] : s.sources;
                return (
                  <li key={s.id} className="py-3">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
                      <Badge variant="outline" className="text-[10px] py-0 h-4">{src?.name ?? "Social"}</Badge>
                      {s.author && <span>u/{s.author}</span>}
                      {s.published_at && <span>· {formatDistanceToNow(new Date(s.published_at))} ago</span>}
                      {s.location && <span>· {s.location}</span>}
                    </div>
                    <a href={s.url ?? "#"} target="_blank" rel="noreferrer noopener" className="text-sm text-foreground hover:text-primary line-clamp-2">
                      {s.text}
                    </a>
                    {s.hashtags && s.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {s.hashtags.slice(0, 6).map((h: string) => (
                          <Link key={h} to="/hashtags" className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground hover:text-primary">#{h}</Link>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<MessagesSquare className="w-5 h-5 text-muted-foreground" />} title="No social signals yet" description="Once providers sync, public posts will appear here." />
          )}
        </Widget>
      </div>
    </PageShell>
  );
}
