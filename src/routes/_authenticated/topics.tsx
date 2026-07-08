import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Tags, Search } from "lucide-react";
import { useState } from "react";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Widget } from "@/components/widget";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { listTopics } from "@/lib/trends/trends.functions";

export const Route = createFileRoute("/_authenticated/topics")({
  head: () => ({ meta: [{ title: "Topics — Trendy Naija" }, { name: "description", content: "AI-normalized topics extracted from news and Google Trends." }] }),
  component: TopicsPage,
});

function TopicsPage() {
  const [q, setQ] = useState("");
  const listFn = useServerFn(listTopics);
  const topics = useQuery({
    queryKey: ["topics-list", q],
    queryFn: () => listFn({ data: { q: q || undefined, limit: 100 } }),
  });

  return (
    <PageShell
      title="Topics"
      description="Normalized topics discovered across news and Google Trends."
      actions={
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search topics…" className="pl-8 h-8 text-sm" />
        </div>
      }
    >
      <Widget title={q ? `Results for "${q}"` : "All topics"}>
        {topics.data && topics.data.length > 0 ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {topics.data.map((t) => (
              <li key={t.id}>
                <Link
                  to="/topics/$slug"
                  params={{ slug: t.slug }}
                  className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 hover:bg-muted/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {t.category ?? "uncategorized"} · updated {formatDistanceToNow(new Date(t.updated_at))} ago
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Tags className="w-5 h-5 text-muted-foreground" />} title="No topics yet" description="Topics appear as news and Google Trends are ingested." />
        )}
      </Widget>
    </PageShell>
  );
}
