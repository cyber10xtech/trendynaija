import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Widget } from "@/components/widget";

export const Route = createFileRoute("/_authenticated/trending")({
  head: () => ({ meta: [{ title: "Trending — Trendy Naija" }, { name: "description", content: "Top trending topics and hashtags right now." }] }),
  component: () => (
    <PageShell title="Trending" description="Topics and hashtags with the highest trend scores.">
      <Widget title="Trending topics" subtitle="Ranked by weighted trend score">
        <EmptyState icon={<TrendingUp className="w-5 h-5 text-muted-foreground" />} title="No trends detected yet" description="Trend detection activates once providers are ingesting data." />
      </Widget>
    </PageShell>
  ),
});
