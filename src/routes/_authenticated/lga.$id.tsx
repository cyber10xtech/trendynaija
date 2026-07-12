import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/page-shell";
import { EmptyState, Widget } from "@/components/widget";
import { getLgaOverview } from "@/lib/regional/regional.functions";

export const Route = createFileRoute("/_authenticated/lga/$id")({
  head: () => ({ meta: [{ title: "LGA — Trendy Naija" }] }),
  component: LgaPage,
});

function LgaPage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getLgaOverview);
  const q = useQuery({ queryKey: ["lga", id], queryFn: () => fn({ data: { lgaId: id, window: "24h" } }) });
  const l = q.data?.lga;
  return (
    <PageShell title={l?.name ?? "LGA"} description={l?.states?.name ?? ""}>
      <Widget title="Signals">
        {q.data?.stats && q.data.stats.length > 0 ? (
          <pre className="text-xs">{JSON.stringify(q.data.stats, null, 2)}</pre>
        ) : (
          <EmptyState title="No LGA-level signals yet" description="LGA rollups appear once we have geotagged social evidence for this area." />
        )}
      </Widget>
    </PageShell>
  );
}
