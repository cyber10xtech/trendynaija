import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings, Cpu, MapPin, Map, Sliders, Plug } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Widget } from "@/components/widget";

const sections = [
  { title: "Provider Configuration", desc: "Connect and configure ingestion sources.", icon: Plug },
  { title: "AI Configuration", desc: "Choose models and tune pipeline stages.", icon: Cpu },
  { title: "State Management", desc: "Enable states as we expand coverage.", icon: MapPin },
  { title: "LGA Management", desc: "Manage LGAs and locality mappings.", icon: Map },
  { title: "System Settings", desc: "Global platform settings.", icon: Sliders },
];

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Trendy Naija" }, { name: "description", content: "Configure providers, AI, states, LGAs and system settings." }] }),
  component: () => (
    <PageShell title="Settings" description="Platform administration.">
      <div className="grid gap-5 md:grid-cols-2">
        {sections.map((s) => (
          <Widget key={s.title} title={s.title} subtitle={s.desc}>
            <div className="flex items-center justify-between">
              <s.icon className="w-8 h-8 text-muted-foreground" />
              <Link to="/settings" className="text-xs text-muted-foreground">Coming soon</Link>
            </div>
          </Widget>
        ))}
      </div>
    </PageShell>
  ),
});
