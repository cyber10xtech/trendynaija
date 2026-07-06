import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, Newspaper, Sparkles, Hash, Tags, LineChart, PieChart, Smile, Activity } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Widget, EmptyState } from "@/components/widget";
import { Badge } from "@/components/ui/badge";

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
  return (
    <PageShell
      title="Dashboard"
      description="Discover what Nigeria is talking about — starting with Imo State."
      actions={<Badge variant="secondary" className="rounded-full">Imo State · Live</Badge>}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Widget title="Trending Now" subtitle="Highest scoring topics this hour" className="lg:col-span-2">
          <EmptyState icon={<TrendingUp className="w-5 h-5 text-muted-foreground" />} title="No trends yet" description="Connect a provider to start detecting trends across Imo State." />
        </Widget>
        <Widget title="AI Summary" subtitle="What just happened, in plain English">
          <EmptyState icon={<Sparkles className="w-5 h-5 text-muted-foreground" />} title="No summary yet" description="Summaries appear once articles are ingested and clustered." />
        </Widget>

        <Widget title="Latest News" subtitle="Deduplicated & clustered" className="lg:col-span-2">
          <EmptyState icon={<Newspaper className="w-5 h-5 text-muted-foreground" />} title="No news yet" />
        </Widget>
        <Widget title="Top Hashtags" subtitle="Rising across sources">
          <EmptyState icon={<Hash className="w-5 h-5 text-muted-foreground" />} title="No hashtags yet" />
        </Widget>

        <Widget title="Topic Categories">
          <EmptyState icon={<Tags className="w-5 h-5 text-muted-foreground" />} title="No topics yet" />
        </Widget>
        <Widget title="Trend Timeline">
          <EmptyState icon={<LineChart className="w-5 h-5 text-muted-foreground" />} title="Timeline empty" />
        </Widget>
        <Widget title="Source Distribution">
          <EmptyState icon={<PieChart className="w-5 h-5 text-muted-foreground" />} title="No sources yet" />
        </Widget>

        <Widget title="Sentiment">
          <EmptyState icon={<Smile className="w-5 h-5 text-muted-foreground" />} title="Sentiment pending" />
        </Widget>
        <Widget title="Provider Health" className="lg:col-span-2">
          <EmptyState icon={<Activity className="w-5 h-5 text-muted-foreground" />} title="No providers connected" description="Register providers in Settings → Provider Configuration." />
        </Widget>
      </div>
    </PageShell>
  );
}
