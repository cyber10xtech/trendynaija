import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Widget, EmptyState } from "@/components/widget";
import { Badge } from "@/components/ui/badge";
import { getArticle } from "@/lib/news/news.functions";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/news/$id")({
  head: () => ({ meta: [{ title: "Article — Trendy Naija" }] }),
  component: ArticleDetail,
});

function ArticleDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(getArticle);
  const { data: article, isLoading } = useQuery({
    queryKey: ["article", id],
    queryFn: () => fn({ data: { id } }),
  });

  if (isLoading) return <PageShell title="Loading article..." />;
  if (!article) {
    return (
      <PageShell title="Article not found">
        <EmptyState title="Not found" description="This article may have been removed." />
      </PageShell>
    );
  }

  const src = article.sources as { name: string; key: string } | null;

  return (
    <PageShell
      title={article.title}
      actions={
        <Link to="/news" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" /> Back
        </Link>
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {article.image_url && <img src={article.image_url} alt="" className="w-full max-h-96 rounded-lg object-cover" />}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {article.category && <Badge variant="outline">{article.category}</Badge>}
            {src && <span>{src.name}</span>}
            {article.author && <span>· {article.author}</span>}
            {article.published_at && <span>· {formatDistanceToNow(new Date(article.published_at))} ago</span>}
          </div>
          {article.summary && (
            <p className="text-base font-medium text-foreground">{article.summary}</p>
          )}
          {article.content && (
            <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
              {article.content}
            </div>
          )}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Read on {src?.name ?? "source"} <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
        <div>
          <Widget title="Related">
            {article.cluster_id ? (
              <Link to="/news/cluster/$id" params={{ id: article.cluster_id }} className="text-sm text-primary hover:underline">
                View full story cluster →
              </Link>
            ) : (
              <div className="text-xs text-muted-foreground">No related coverage yet.</div>
            )}
          </Widget>
        </div>
      </div>
    </PageShell>
  );
}
