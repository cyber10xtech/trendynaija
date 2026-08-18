/**
 * Copilot thread management. Every read/write is scoped to the signed-in user
 * by requireSupabaseAuth + RLS.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface Conversation {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts: Array<{ type: string; text?: string }>;
  evidence: Array<{ tag: string; label: string; kind: string; ref: string; url?: string | null }>;
  created_at: string;
}

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = (i ?? {}) as { archived?: boolean };
    return { archived: !!v.archived };
  })
  .handler(async ({ data, context }): Promise<Conversation[]> => {
    const { data: rows, error } = await context.supabase
      .from("copilot_conversations")
      .select("id, title, pinned, archived, message_count, last_message_at, created_at, updated_at")
      .eq("archived", data.archived)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (rows ?? []) as Conversation[];
  });

export const setConversationArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = i as { id: string; archived: boolean };
    if (!v?.id) throw new Error("id required");
    return { id: v.id, archived: !!v.archived };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("copilot_conversations")
      .update({ archived: data.archived })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = (i ?? {}) as { title?: string };
    return { title: (v.title ?? "New conversation").slice(0, 120) };
  })
  .handler(async ({ data, context }): Promise<Conversation> => {
    const { data: row, error } = await context.supabase
      .from("copilot_conversations")
      .insert({ user_id: context.userId, title: data.title })
      .select("id, title, pinned, archived, message_count, last_message_at, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as Conversation;
  });

export const getConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = i as { id: string };
    if (!v?.id) throw new Error("id required");
    return { id: v.id };
  })
  .handler(async ({ data, context }): Promise<{ conversation: Conversation | null; messages: StoredMessage[] }> => {
    const { data: conv } = await context.supabase
      .from("copilot_conversations")
      .select("id, title, pinned, archived, message_count, last_message_at, created_at, updated_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!conv) return { conversation: null, messages: [] };
    // Load only the most recent slice; older turns stay in the database.
    const { data: msgs } = await context.supabase
      .from("copilot_messages")
      .select("id, role, content, parts, evidence, created_at")
      .eq("conversation_id", data.id)
      .order("created_at", { ascending: false })
      .limit(60);
    return {
      conversation: conv as Conversation,
      messages: (msgs ?? []).slice().reverse().map((m) => ({
        id: m.id,
        role: m.role as StoredMessage["role"],
        content: m.content,
        parts: (Array.isArray(m.parts) && m.parts.length
          ? m.parts
          : [{ type: "text", text: m.content }]) as StoredMessage["parts"],
        evidence: (Array.isArray(m.evidence) ? m.evidence : []) as StoredMessage["evidence"],
        created_at: m.created_at,
      })),
    };
  });

export const renameConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = i as { id: string; title: string };
    if (!v?.id || !v?.title?.trim()) throw new Error("id and title required");
    return { id: v.id, title: v.title.trim().slice(0, 120) };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("copilot_conversations")
      .update({ title: data.title })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setConversationPinned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = i as { id: string; pinned: boolean };
    if (!v?.id) throw new Error("id required");
    return { id: v.id, pinned: !!v.pinned };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("copilot_conversations")
      .update({ pinned: data.pinned })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => {
    const v = i as { id: string };
    if (!v?.id) throw new Error("id required");
    return { id: v.id };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("copilot_conversations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
