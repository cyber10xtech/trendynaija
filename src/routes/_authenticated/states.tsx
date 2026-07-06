import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Widget } from "@/components/widget";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/states")({
  head: () => ({ meta: [{ title: "States — Trendy Naija" }, { name: "description", content: "Trend coverage across Nigeria's 36 states + FCT." }] }),
  component: StatesPage,
});

function StatesPage() {
  const { data } = useQuery({
    queryKey: ["states"],
    queryFn: async () => {
      const { data, error } = await supabase.from("states").select("id, code, name, region, capital, is_active").order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <PageShell title="States" description="Trendy Naija launches with Imo State and expands from there.">
      <Widget title="Coverage">
        {!data || data.length === 0 ? (
          <EmptyState icon={<MapPin className="w-5 h-5 text-muted-foreground" />} title="Loading states…" />
        ) : (
          <ul className="divide-y divide-border">
            {data.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.region} · {s.capital}</div>
                </div>
                <Badge variant={s.is_active ? "default" : "secondary"} className="rounded-full">
                  {s.is_active ? "Active" : "Coming soon"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Widget>
    </PageShell>
  );
}
