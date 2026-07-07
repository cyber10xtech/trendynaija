import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search, Newspaper } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Widget, EmptyState } from "@/components/widget";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { listLatestClusters, listArticles } from "@/lib/news/news.functions";
import { NEWS_CATEGORIES } from "@/lib/news/categories";
import { formatDistanceToNow } from "date-fns";

interface NewsSearch {
  category?: string;
  q?: string;
  view?: "clusters" | "articles";
}

export const Route = createFileRoute("/_authenticated/news")({
  validateSearch: (s: Record<string, unknown>): NewsSearch => ({
    category: typeof s.category === "string" ? s.category : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
    view: s.view === "articles" ? "articles" : "clusters",
  }),
  head: () => ({
    meta: [
      { title: "News — Trendy Naija" },
      { name: "description", content: "Deduplicated, clustered news across Nigerian sources." },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const { category, q, view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [term, setTerm] = useState(q ?? "");

  const clustersFn = useServerFn(listLatestClusters);
  const articlesFn = useServerFn(listArticles);

  const clusters = useQuery({
    queryKey: ["clusters", category],
    queryFn: () => clustersFn({ data: { limit: 40, category } }),
    enabled: view !== "articles",
  });
  const articles = useQuery({
    queryKey: ["articles", category, q],
    queryFn: () => articlesFn({ data: { limit: 40, category, q } }),
    enabled: view === "articles" || !!q,
  });

  const showArticles = view === "articles" || !!q;

  return (
    <PageShell title="News" description="One clustered story per event — no duplicates.">
      <div className="space-y-5">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ search: (prev: NewsSearch) => ({ ...prev, q: term || undefined, view: "articles" as const }) });
            }}
            className="relative flex-1"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search articles by title..."
              className="pl-9"
            />
          </form>
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => navigate({ search: (p: NewsSearch) => ({ ...p, category: undefined }) })}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${!category ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              All
            </button>
            {NEWS_CATEGORIES.slice(0, 8).map((c) => (
              <button
                key={c}
                onClick={() => navigate({ search: (p: NewsSearch) => ({ ...p, category: c }) })}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${category === c ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {showArticles ? (
          <Widget title={q ? `Search: "${q}"` : "All articles"} subtitle={`${articles.data?.total ?? 0} results`}>
            {articles.data && articles.data.articles.length > 0 ? (
              <ul className="divide-y divide-border">
                {articles.data.articles.map((a) => (
                  <li key={a.id}>
                    <Link to="/news/$id" params={{ id: a.id }} className="flex items-start gap-3 py-3 group">
                      {a.image_url && <img src={a.image_url} alt="" className="w-24 h-20 rounded-md object-cover flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {a.category && <Badge variant="outline" className="text-[10px] py-0 h-4">{a.category}</Badge>}
                          {a.sources && <span className="text-[11px] text-muted-foreground">{(a.sources as { name: string }).name}</span>}
                          {a.published_at && <span className="text-[11px] text-muted-foreground">· {formatDistanceToNow(new Date(a.published_at))} ago</span>}
                        </div>
                        <div className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">{a.title}</div>
                        {a.summary && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.summary}</div>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Newspaper className="w-5 h-5 text-muted-foreground" />} title="No articles" description="Try a different search or category." />
            )}
          </Widget>
        ) : (
          <Widget title="Story clusters" subtitle="Related articles grouped as one story">
            {clusters.data && clusters.data.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {clusters.data.map((c) => (
                  <Link key={c.id} to="/news/cluster/$id" params={{ id: c.id }} className="card-surface p-4 hover:border-primary/40 transition-colors group">
                    {c.image_url && <img src={c.image_url} alt="" className="w-full h-40 rounded-md object-cover mb-3" />}
                    <div className="flex items-center gap-2 mb-1.5">
                      {c.category && <Badge variant="outline" className="text-[10px]">{c.category}</Badge>}
                      <span className="text-[11px] text-muted-foreground">{c.article_count} sources</span>
                      {c.last_seen_at && <span className="text-[11px] text-muted-foreground">· {formatDistanceToNow(new Date(c.last_seen_at))} ago</span>}
                    </div>
                    <h3 className="text-base font-semibold group-hover:text-primary transition-colors line-clamp-2">{c.title}</h3>
                    {c.summary && <p className="text-sm text-muted-foreground mt-1.5 line-clamp-3">{c.summary}</p>}
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Newspaper className="w-5 h-5 text-muted-foreground" />} title="No clusters yet" description="Sync a provider from Provider Health to populate this." />
            )}
          </Widget>
        )}
      </div>
    </PageShell>
  );
}
