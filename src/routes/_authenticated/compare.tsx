import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { GitCompare, Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Widget } from "@/components/widget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { compareRegions } from "@/lib/regional/regional.functions";
import { compareRegionsInsight } from "@/lib/regional/regional.admin.functions";

export const Route = createFileRoute("/_authenticated/compare")({
  head: () => ({ meta: [{ title: "Compare regions — Trendy Naija" }] }),
  component: ComparePage,
});

function ComparePage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [insight, setInsight] = useState<{ summary?: string; keyPoints?: string[] } | null>(null);
  const compareFn = useServerFn(compareRegions);
  const insightFn = useServerFn(compareRegionsInsight);

  const states = useQuery({
    queryKey: ["all-states"],
    queryFn: async () => {
      const { data } = await supabase.from("states").select("id, name, code").order("name");
      return data ?? [];
    },
  });

  const cmp = useQuery({
    queryKey: ["compare", selected],
    queryFn: () => compareFn({ data: { stateIds: selected } }),
    enabled: selected.length >= 2,
  });

  const genInsight = useMutation({
    mutationFn: () => insightFn({ data: { stateIds: selected } }),
    onSuccess: (r) => r.ok ? setInsight({ summary: r.summary, keyPoints: r.keyPoints }) : toast.error(r.error ?? "AI failed"),
  });

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length < 4 ? [...s, id] : s);

  return (
    <PageShell
      title="Compare regions"
      description="Compare up to 4 states side by side."
      actions={
        <Button size="sm" variant="outline" disabled={selected.length < 2 || genInsight.isPending} onClick={() => genInsight.mutate()}>
          <Sparkles className="w-3.5 h-3.5 mr-1.5" /> AI comparison
        </Button>
      }
    >
      <Widget title="Pick states" className="mb-5">
        <div className="flex flex-wrap gap-1.5">
          {(states.data ?? []).map((s) => (
            <button key={s.id} onClick={() => toggle(s.id)}>
              <Badge variant={selected.includes(s.id) ? "default" : "outline"} className="cursor-pointer">{s.name}</Badge>
            </button>
          ))}
        </div>
      </Widget>

      {insight && (
        <Widget title="AI comparison" className="mb-5">
          <p className="text-sm">{insight.summary}</p>
          {insight.keyPoints && (
            <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground space-y-1">
              {insight.keyPoints.map((k, i) => <li key={i}>{k}</li>)}
            </ul>
          )}
        </Widget>
      )}

      <Widget title="Side by side">
        {selected.length < 2 ? (
          <EmptyState icon={<GitCompare className="w-5 h-5 text-muted-foreground" />} title="Pick at least two states to compare" />
        ) : cmp.data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cmp.data.states.map((s) => (
              <div key={s.id} className="p-3 rounded-md bg-muted/30">
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  score {s.summary?.trend_score?.toFixed?.(2) ?? "—"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  news {s.summary?.news_count ?? 0} · social {s.summary?.social_count ?? 0}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Loading…" />
        )}
      </Widget>
    </PageShell>
  );
}
