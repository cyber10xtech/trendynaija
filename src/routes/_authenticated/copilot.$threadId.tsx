import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Flame } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getConversation } from "@/lib/copilot/copilot.functions";

export const Route = createFileRoute("/_authenticated/copilot/$threadId")({
  head: () => ({
    meta: [
      { title: "Copilot conversation — Trendy Naija" },
      { name: "description", content: "A grounded Copilot conversation about Nigerian trends, with citations from stored intelligence." },
      { property: "og:title", content: "Copilot conversation — Trendy Naija" },
      { property: "og:description", content: "Grounded conversational trend intelligence for Nigeria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CopilotThread,
});

function CopilotThread() {
  const { threadId } = Route.useParams();
  const getFn = useServerFn(getConversation);
  const thread = useQuery({
    queryKey: ["copilot-thread", threadId],
    queryFn: () => getFn({ data: { id: threadId } }),
  });

  if (thread.isLoading) {
    return <div className="flex-1 grid place-items-center text-sm text-muted-foreground">Loading conversation…</div>;
  }
  if (!thread.data?.conversation) {
    return <div className="flex-1 grid place-items-center text-sm text-muted-foreground">Conversation not found.</div>;
  }

  const initial: UIMessage[] = thread.data.messages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: (m.parts.length ? m.parts : [{ type: "text", text: m.content }]) as UIMessage["parts"],
  }));

  return (
    <ChatWindow
      key={threadId}
      threadId={threadId}
      title={thread.data.conversation.title}
      initialMessages={initial}
    />
  );
}

const SUGGESTIONS = [
  "What is trending in Imo State right now?",
  "Summarise today's biggest story cluster.",
  "Which hashtags are gaining the most momentum?",
  "Compare news volume across the top states.",
  "What is unique about Imo State today?",
  "Which topics are emerging fastest this week?",
  "Give me today's executive brief for Nigeria.",
  "Why is the top topic trending?",
];

const FOLLOW_UPS = [
  "Why is this trending?",
  "Show the sources behind this.",
  "How does this compare to yesterday?",
  "What could happen next?",
];

function ChatWindow({
  threadId,
  title,
  initialMessages,
}: {
  threadId: string;
  title: string;
  initialMessages: UIMessage[];
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/copilot",
        prepareSendMessagesRequest: async ({ messages }) => {
          const { data } = await supabase.auth.getSession();
          return {
            headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
            body: { messages, conversationId: threadId },
          };
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error("Copilot error", { description: e.message }),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy, threadId]);

  const ask = (text: string) => {
    if (!text.trim() || busy) return;
    void sendMessage({ text: text.trim() });
  };

  const lastMessage = messages[messages.length - 1];
  const showFollowUps = !busy && lastMessage?.role === "assistant";

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="h-12 sm:h-14 shrink-0 flex items-center gap-2 px-4 sm:px-5 border-b border-border">
        <Flame className="w-4 h-4 shrink-0 text-primary" />
        <h1 className="text-sm font-medium truncate min-w-0">{title}</h1>
        <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] ml-auto shrink-0">
          grounded · cited
        </Badge>
      </header>

      <Conversation className="flex-1 min-h-0">
        <ConversationContent className="max-w-3xl mx-auto w-full px-3 sm:px-4">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Ask the Copilot"
              description="Answers come only from Trendy Naija's stored intelligence, with citation tags."
            >
              <div className="mt-4 grid sm:grid-cols-2 gap-2 w-full max-w-xl">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="text-left text-xs rounded-md border border-border px-3 py-2.5 hover:bg-muted/60 active:bg-muted transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m) => {
              const text = m.parts
                .map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
                .join("");
              return (
                <Message from={m.role} key={m.id}>
                  {m.role === "user" ? (
                    <MessageContent className="bg-primary text-primary-foreground">{text}</MessageContent>
                  ) : (
                    <MessageResponse>{text}</MessageResponse>
                  )}
                </Message>
              );
            })
          )}
          {status === "submitted" && <Shimmer className="text-sm">Reading the intelligence store…</Shimmer>}

          {showFollowUps && (
            <div className="flex flex-wrap gap-2 pt-1">
              {FOLLOW_UPS.map((f) => (
                <button
                  key={f}
                  onClick={() => ask(f)}
                  className="text-[11px] rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div
        className="shrink-0 p-3 sm:p-4 border-t border-border bg-background"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-3xl mx-auto">
          <PromptInput
            onSubmit={(message) => {
              ask(message.text ?? "");
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              placeholder="Ask about Nigerian trends…"
              className="text-base sm:text-sm"
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={busy} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
