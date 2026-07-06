import { createFileRoute } from "@tanstack/react-router";
import { Tags } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Widget } from "@/components/widget";

export const Route = createFileRoute("/_authenticated/topics")({
  head: () => ({ meta: [{ title: "Topics — Trendy Naija" }, { name: "description", content: "AI-extracted topics and categories." }] }),
  component: () => (
    <PageShell title="Topics" description="AI-extracted topics grouped by category.">
      <Widget title="All topics">
        <EmptyState icon={<Tags className="w-5 h-5 text-muted-foreground" />} title="No topics extracted yet" />
      </Widget>
    </PageShell>
  ),
});
