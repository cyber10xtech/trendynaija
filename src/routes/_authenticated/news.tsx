import { createFileRoute } from "@tanstack/react-router";
import { Newspaper } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Widget } from "@/components/widget";

export const Route = createFileRoute("/_authenticated/news")({
  head: () => ({ meta: [{ title: "News — Trendy Naija" }, { name: "description", content: "Deduplicated, clustered news across Nigerian sources." }] }),
  component: () => (
    <PageShell title="News" description="One clustered story per event — no duplicates.">
      <Widget title="Latest clusters">
        <EmptyState icon={<Newspaper className="w-5 h-5 text-muted-foreground" />} title="No articles yet" description="Once news providers are connected, clustered stories will appear here." />
      </Widget>
    </PageShell>
  ),
});
