import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Widget, EmptyState } from "@/components/widget";
import { Badge } from "@/components/ui/badge";
import { getClusterDetail } from "@/lib/news/news.functions";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/news/cluster/$id")({
  head: () => ({ meta: [{ title: "Story cluster — Trendy Naija" }] }),
  component: ClusterDetail,
});

function ClusterDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(getClusterDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["cluster", id],
    queryFn: () => fn({ data: { id } }),
  });

  if (isLoading) return <PageShell title="Loading story..." />;
  if (!data) {
    return (
      <PageShell title="Story not found">
        <EmptyState title="Cluster missing" description="It may have been merged or removed." />
      </PageShell>
    );
  }

  const { cluster, articles, summary } = data;

  return (
    <PageShell
      title={cluster.title}
      description={cluster.summary ?? undefined}
      actions={
        <Link to="/news" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" /> Back to news
        </Link>
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <Widget title="AI Summary" subtitle={summary?.model ?? undefined}>
            {summary ? (
              <div className="space-y-4">
                {summary.short_summary && (
                  <p className="text-sm font-medium text-foreground">{summary.short_summary}</p>
                )}
                {summary.detailed_summary && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{summary.detailed_summary}</p>
                )}
                {Array.isArray(summary.bullet_points) && summary.bullet_points.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-foreground mb-2">Key points</div>
                    <ul className="space-y-1.5">
                      {(summary.bullet_points as string[]).map((p, i) => (
                        <li key={i} className="flex gap-2 text-sm text-foreground/90">
                          <span className="text-primary">•</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {summary.confidence != null && (
                  <div className="text-[11px] text-muted-foreground">
                    Confidence: {Math.round(Number(summary.confidence) * 100)}%
                  </div>
                )}
              </div>
            ) : (
              <EmptyState icon={<Sparkles className="w-5 h-5 text-muted-foreground" />} title="Summary pending" description="An AI summary will appear shortly after the next ingestion pass." />
            )}
          </Widget>

          <Widget title={`Sources (${articles.length})`} subtitle="Every outlet reporting this story">
            <ul className="divide-y divide-border">
              {articles.map((a: {
                id: string;
                title: string;
                url: string;
                author: string | null;
                published_at: string | null;
                sources: { name: string } | { name: string }[] | null;
              }) => {
                const src = Array.isArray(a.sources) ? a.sources[0] : a.sources;
                return (
                  <li key={a.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:text-primary inline-flex items-center gap-1">
                          {a.title}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {src?.name}
                          {a.author ? ` · ${a.author}` : ""}
                          {a.published_at ? ` · ${formatDistanceToNow(new Date(a.published_at))} ago` : ""}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Widget>
        </div>

        <div className="space-y-5">
          <Widget title="Metadata">
            <div className="space-y-3 text-xs">
              {cluster.category && (
                <div>
                  <div className="text-muted-foreground mb-1">Category</div>
                  <Badge variant="secondary">{cluster.category}</Badge>
                </div>
              )}
              {Array.isArray(summary?.topics) && summary.topics.length > 0 && (
                <div>
                  <div className="text-muted-foreground mb-1">Topics</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(summary.topics as string[]).map((t) => (
                      <Badge key={t} variant="outline">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {summary?.entities ? (
                <EntitiesBlock entities={summary.entities as { people?: string[]; organizations?: string[]; locations?: string[] }} />
              ) : null}
              <div>
                <div className="text-muted-foreground mb-1">Timeline</div>
                <div>First seen {cluster.first_seen_at ? formatDistanceToNow(new Date(cluster.first_seen_at)) + " ago" : "—"}</div>
                <div>Last seen {cluster.last_seen_at ? formatDistanceToNow(new Date(cluster.last_seen_at)) + " ago" : "—"}</div>
              </div>
            </div>
          </Widget>
        </div>
      </div>
    </PageShell>
  );
}

function EntitiesBlock({ entities }: { entities: { people?: string[]; organizations?: string[]; locations?: string[] } }) {
  const groups: Array<[string, string[] | undefined]> = [
    ["People", entities.people],
    ["Organizations", entities.organizations],
    ["Locations", entities.locations],
  ];
  return (
    <>
      {groups.map(([label, arr]) =>
        arr && arr.length > 0 ? (
          <div key={label}>
            <div className="text-muted-foreground mb-1">{label}</div>
            <div className="flex flex-wrap gap-1.5">
              {arr.map((v) => <Badge key={v} variant="outline">{v}</Badge>)}
            </div>
          </div>
        ) : null,
      )}
    </>
  );
}
