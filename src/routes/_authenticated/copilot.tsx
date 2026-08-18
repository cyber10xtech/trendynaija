import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive, ArchiveRestore, Pencil, Pin, PinOff, Plus, Search, Trash2, MessageSquare, Menu, Flame,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { MobileNav } from "@/components/app-sidebar";
import { cn } from "@/lib/utils";
import {
  createConversation,
  deleteConversation,
  listConversations,
  renameConversation,
  setConversationArchived,
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
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);

  const listFn = useServerFn(listConversations);
  const createFn = useServerFn(createConversation);
  const pinFn = useServerFn(setConversationPinned);
  const delFn = useServerFn(deleteConversation);
  const archiveFn = useServerFn(setConversationArchived);
  const renameFn = useServerFn(renameConversation);

  useEffect(() => setDrawerOpen(false), [params.threadId]);

  const threads = useQuery({
    queryKey: ["copilot-threads", showArchived],
    queryFn: () => listFn({ data: { archived: showArchived } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["copilot-threads"] });

  const create = useMutation({
    mutationFn: () => createFn({ data: {} }),
    onSuccess: (c) => {
      invalidate();
      navigate({ to: "/copilot/$threadId", params: { threadId: c.id } });
    },
    onError: (e: Error) => toast.error("Could not start a conversation", { description: e.message }),
  });

  const pin = useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) => pinFn({ data: v }),
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: (v: { id: string; archived: boolean }) => archiveFn({ data: v }),
    onSuccess: (_r, v) => {
      invalidate();
      if (v.archived && params.threadId === v.id) navigate({ to: "/copilot" });
    },
  });

  const rename = useMutation({
    mutationFn: (v: { id: string; title: string }) => renameFn({ data: v }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["copilot-thread"] });
      setRenaming(null);
    },
    onError: (e: Error) => toast.error("Rename failed", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: (_r, id) => {
      invalidate();
      if (params.threadId === id) navigate({ to: "/copilot" });
    },
  });

  const visible = (threads.data ?? []).filter((t) =>
    filter ? t.title.toLowerCase().includes(filter.toLowerCase()) : true,
  );

  const sidebarBody = (
    <>
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <Flame className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="text-sm font-semibold tracking-tight">Trendy Naija</div>
      </div>

      <div className="p-3 border-b border-border space-y-2">
        <Button className="w-full" size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="w-4 h-4 mr-1.5" /> New conversation
        </Button>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search conversations"
            className="h-9 pl-8 text-xs"
          />
        </div>
        <button
          className="w-full text-left text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? "← Back to active conversations" : "View archived conversations"}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {visible.length === 0 && (
          <p className="px-2 py-6 text-xs text-muted-foreground text-center">
            {showArchived
              ? "No archived conversations."
              : "No conversations yet. Start one to ask about Nigerian trends."}
          </p>
        )}
        {visible.map((t) => {
          const active = params.threadId === t.id;
          return (
            <div
              key={t.id}
              className={cn(
                "group flex items-center gap-0.5 rounded-md px-1.5 py-1 transition-colors",
                active ? "bg-primary/10" : "hover:bg-muted/60",
              )}
            >
              <Link
                to="/copilot/$threadId"
                params={{ threadId: t.id }}
                className="flex-1 min-w-0 px-1 py-1.5"
              >
                <div className={cn("truncate text-sm", active ? "font-medium text-foreground" : "text-foreground/80")}>
                  {t.pinned && !showArchived ? "📌 " : ""}{t.title}
                </div>
                <div className="text-[10px] text-muted-foreground">{t.message_count} messages</div>
              </Link>
              <div className="flex items-center opacity-100 md:opacity-0 md:group-hover:opacity-100">
                <button
                  aria-label="Rename conversation"
                  className="p-2 md:p-1 rounded text-muted-foreground hover:text-foreground"
                  onClick={() => setRenaming({ id: t.id, title: t.title })}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  aria-label={t.pinned ? "Unpin conversation" : "Pin conversation"}
                  className="p-2 md:p-1 rounded text-muted-foreground hover:text-foreground"
                  onClick={() => pin.mutate({ id: t.id, pinned: !t.pinned })}
                >
                  {t.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </button>
                <button
                  aria-label={t.archived ? "Restore conversation" : "Archive conversation"}
                  className="p-2 md:p-1 rounded text-muted-foreground hover:text-foreground"
                  onClick={() => archive.mutate({ id: t.id, archived: !t.archived })}
                >
                  {t.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                </button>
                <button
                  aria-label="Delete conversation"
                  className="p-2 md:p-1 rounded text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(t.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border text-[10px] text-muted-foreground flex items-center gap-1.5">
        <MessageSquare className="w-3 h-3" /> Answers are grounded in stored intelligence.
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden">
      <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-border bg-card/40">
        {sidebarBody}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile / tablet top bar: app nav + conversation drawer */}
        <div
          className="lg:hidden shrink-0 flex items-center gap-1 px-3 h-14 border-b border-border bg-background/90 backdrop-blur"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <MobileNav />
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger
              aria-label="Open conversations"
              className="inline-flex items-center gap-1.5 h-10 px-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Menu className="w-4 h-4" /> Conversations
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[18rem] p-0 flex flex-col"
              style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <SheetTitle className="sr-only">Copilot conversations</SheetTitle>
              {sidebarBody}
            </SheetContent>
          </Sheet>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => create.mutate()}
            disabled={create.isPending}
          >
            <Plus className="w-4 h-4 mr-1" /> New
          </Button>
        </div>

        <Outlet />
      </div>

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
          </DialogHeader>
          <Input
            value={renaming?.title ?? ""}
            onChange={(e) => setRenaming((r) => (r ? { ...r, title: e.target.value } : r))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renaming?.title.trim()) rename.mutate(renaming);
            }}
            placeholder="Conversation title"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button
              onClick={() => renaming?.title.trim() && rename.mutate(renaming)}
              disabled={!renaming?.title.trim() || rename.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
