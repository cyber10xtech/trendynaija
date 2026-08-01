import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pin, PinOff, Plus, Search, Trash2, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createConversation,
  deleteConversation,
  listConversations,
  setConversationPinned,
} from "@/lib/copilot/copilot.functions";

export const Route = createFileRoute("/_authenticated/copilot")({
  head: () => ({
    meta: [
      { title: "AI Copilot — Trendy Naija" },
      { name: "description", content: "Ask Trendy Naija's AI Copilot what Nigeria is talking about. Grounded answers with citations from live trend intelligence." },
      { property: "og:title", content: "AI Copilot — Trendy Naija" },
      { property: "og:description", content: "Grounded conversational intelligence over Nigerian news, search and social trends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CopilotLayout,
});

function CopilotLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const params = useParams({ strict: false }) as { threadId?: string };
  const [filter, setFilter] = useState("");

  const listFn = useServerFn(listConversations);
  const createFn = useServerFn(createConversation);
  const pinFn = useServerFn(setConversationPinned);
  const delFn = useServerFn(deleteConversation);

  const threads = useQuery({ queryKey: ["copilot-threads"], queryFn: () => listFn() });

  const create = useMutation({
    mutationFn: () => createFn({ data: {} }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["copilot-threads"] });
      navigate({ to: "/copilot/$threadId", params: { threadId: c.id } });
    },
    onError: (e: Error) => toast.error("Could not start a conversation", { description: e.message }),
  });

  const pin = useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) => pinFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["copilot-threads"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ["copilot-threads"] });
      if (params.threadId === id) navigate({ to: "/copilot" });
    },
  });

  const visible = (threads.data ?? []).filter((t) =>
    filter ? t.title.toLowerCase().includes(filter.toLowerCase()) : true,
  );

  return (
    <div className="flex h-[calc(100vh-0px)] min-h-0">
      <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-border bg-card/40">
        <div className="p-3 border-b border-border space-y-2">
          <Button className="w-full" size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="w-4 h-4 mr-1.5" /> New conversation
          </Button>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search history"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {visible.length === 0 && (
            <p className="px-2 py-6 text-xs text-muted-foreground text-center">
              No conversations yet. Start one to ask about Nigerian trends.
            </p>
          )}
          {visible.map((t) => {
            const active = params.threadId === t.id;
            return (
              <div
                key={t.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors",
                  active ? "bg-primary/10" : "hover:bg-muted/60",
                )}
              >
                <Link
                  to="/copilot/$threadId"
                  params={{ threadId: t.id }}
                  className="flex-1 min-w-0 px-1 py-1.5"
                >
                  <div className={cn("truncate text-sm", active ? "font-medium text-foreground" : "text-foreground/80")}>
                    {t.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{t.message_count} messages</div>
                </Link>
                <button
                  aria-label={t.pinned ? "Unpin conversation" : "Pin conversation"}
                  className="p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
                  onClick={() => pin.mutate({ id: t.id, pinned: !t.pinned })}
                >
                  {t.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </button>
                <button
                  aria-label="Delete conversation"
                  className="p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                  onClick={() => remove.mutate(t.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border text-[10px] text-muted-foreground flex items-center gap-1.5">
          <MessageSquare className="w-3 h-3" /> Answers are grounded in stored intelligence.
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
