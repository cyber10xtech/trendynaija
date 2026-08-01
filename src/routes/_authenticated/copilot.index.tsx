import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { createConversation } from "@/lib/copilot/copilot.functions";

export const Route = createFileRoute("/_authenticated/copilot/")({
  head: () => ({
    meta: [
      { title: "AI Copilot — Trendy Naija" },
      { name: "description", content: "Start a grounded conversation about what Nigeria is talking about." },
      { property: "og:title", content: "AI Copilot — Trendy Naija" },
      { property: "og:description", content: "Start a grounded conversation about Nigerian trend intelligence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CopilotIndex,
});

function CopilotIndex() {
  const navigate = useNavigate();
  const createFn = useServerFn(createConversation);
  const create = useMutation({
    mutationFn: () => createFn({ data: {} }),
    onSuccess: (c) => navigate({ to: "/copilot/$threadId", params: { threadId: c.id } }),
  });

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Trendy Naija Copilot</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Ask about trending topics, story clusters, hashtags, regional momentum or today&apos;s brief.
        Every answer is grounded in the platform&apos;s own intelligence, with citations.
      </p>
      <Button onClick={() => create.mutate()} disabled={create.isPending}>
        Start a conversation
      </Button>
    </div>
  );
}
