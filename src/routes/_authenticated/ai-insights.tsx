import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Widget } from "@/components/widget";

export const Route = createFileRoute("/_authenticated/ai-insights")({
  head: () => ({ meta: [{ title: "AI Insights — Trendy Naija" }, { name: "description", content: "AI-generated summaries, sentiment and entity insights." }] }),
  component: () => (
    <PageShell title="AI Insights" description="Summaries, sentiment and entities produced by the AI pipeline.">
      <div className="grid gap-5 md:grid-cols-2">
        <Widget title="Latest summaries"><EmptyState icon={<Sparkles className="w-5 h-5 text-muted-foreground" />} title="No summaries yet" /></Widget>
        <Widget title="Sentiment overview"><EmptyState title="No sentiment yet" /></Widget>
      </div>
    </PageShell>
  ),
});
