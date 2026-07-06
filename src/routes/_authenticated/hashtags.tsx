import { createFileRoute } from "@tanstack/react-router";
import { Hash } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Widget } from "@/components/widget";

export const Route = createFileRoute("/_authenticated/hashtags")({
  head: () => ({ meta: [{ title: "Hashtags — Trendy Naija" }, { name: "description", content: "Trending hashtags across social platforms." }] }),
  component: () => (
    <PageShell title="Hashtags" description="Trending hashtags across social sources.">
      <Widget title="Top hashtags">
        <EmptyState icon={<Hash className="w-5 h-5 text-muted-foreground" />} title="No hashtags yet" />
      </Widget>
    </PageShell>
  ),
});
