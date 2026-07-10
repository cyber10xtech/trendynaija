/**
 * Topic + Entity graph builder.
 *
 * Reads existing ai_summaries (already grounded in real articles) and
 * extracts entities + topic co-occurrences. Purely aggregates over
 * database rows — no fabrication.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 96);
}

async function upsertEntity(name: string, type: string): Promise<string | null> {
  const clean = name.trim();
  if (clean.length < 2) return null;
  const slug = slugify(clean);
  if (!slug) return null;
  const now = new Date().toISOString();
  const { data: existing } = await supabaseAdmin
    .from("entities").select("id, mention_count").eq("slug", slug).maybeSingle();
  if (existing) {
    await supabaseAdmin.from("entities").update({
      mention_count: (existing.mention_count ?? 0) + 1,
      last_seen_at: now,
    }).eq("id", existing.id);
    return existing.id as string;
  }
  const { data: ins, error } = await supabaseAdmin.from("entities").insert({
    name: clean, slug, entity_type: type, mention_count: 1, last_seen_at: now,
  }).select("id").maybeSingle();
  if (error || !ins) return null;
  return ins.id as string;
}

async function linkEntitiesPair(a: string, b: string) {
  const [x, y] = a < b ? [a, b] : [b, a];
  if (x === y) return;
  const { data: existing } = await supabaseAdmin
    .from("entity_relations")
    .select("id, evidence_count, strength")
    .eq("entity_a_id", x).eq("entity_b_id", y).eq("relation_type", "co_mention")
    .maybeSingle();
  const now = new Date().toISOString();
  if (existing) {
    const nextCount = (existing.evidence_count ?? 1) + 1;
    await supabaseAdmin.from("entity_relations").update({
      evidence_count: nextCount,
      strength: Math.min(1, nextCount / 20),
      confidence: Math.min(1, nextCount / 10),
      last_seen_at: now,
    }).eq("id", existing.id);
  } else {
    await supabaseAdmin.from("entity_relations").insert({
      entity_a_id: x, entity_b_id: y, relation_type: "co_mention",
      strength: 0.1, confidence: 0.2, evidence_count: 1, last_seen_at: now,
    });
  }
}

async function linkTopicEntity(topicId: string, entityId: string) {
  const { data: existing } = await supabaseAdmin
    .from("topic_entities").select("id, mentions")
    .eq("topic_id", topicId).eq("entity_id", entityId).maybeSingle();
  const now = new Date().toISOString();
  if (existing) {
    await supabaseAdmin.from("topic_entities").update({
      mentions: (existing.mentions ?? 1) + 1, last_seen_at: now,
    }).eq("id", existing.id);
  } else {
    await supabaseAdmin.from("topic_entities").insert({
      topic_id: topicId, entity_id: entityId, mentions: 1, last_seen_at: now,
    });
  }
}

async function linkTopicsPair(a: string, b: string) {
  const [x, y] = a < b ? [a, b] : [b, a];
  if (x === y) return;
  const { data: existing } = await supabaseAdmin
    .from("topic_relations")
    .select("id, evidence_count")
    .eq("topic_a_id", x).eq("topic_b_id", y).eq("relation_type", "related")
    .maybeSingle();
  const now = new Date().toISOString();
  if (existing) {
    const nextCount = (existing.evidence_count ?? 1) + 1;
    await supabaseAdmin.from("topic_relations").update({
      evidence_count: nextCount,
      strength: Math.min(1, nextCount / 15),
      confidence: Math.min(1, nextCount / 8),
      last_seen_at: now,
    }).eq("id", existing.id);
  } else {
    await supabaseAdmin.from("topic_relations").insert({
      topic_a_id: x, topic_b_id: y, relation_type: "related",
      strength: 0.1, confidence: 0.2, evidence_count: 1, last_seen_at: now,
    });
  }
}

export interface GraphBuildReport {
  summariesProcessed: number;
  entitiesUpserted: number;
  entityLinks: number;
  topicLinks: number;
}

/**
 * Aggregates entity + topic co-occurrences from recent ai_summaries.
 */
export async function rebuildGraphFromSummaries(hoursBack = 72): Promise<GraphBuildReport> {
  const since = new Date(Date.now() - hoursBack * 3_600_000).toISOString();
  const { data: summaries } = await supabaseAdmin
    .from("ai_summaries")
    .select("id, entities, topics")
    .gte("created_at", since)
    .limit(500);

  const report: GraphBuildReport = { summariesProcessed: 0, entitiesUpserted: 0, entityLinks: 0, topicLinks: 0 };
  if (!summaries) return report;

  // Cache topic slug -> id
  const { data: allTopics } = await supabaseAdmin.from("topics").select("id, name, slug");
  const topicBySlug = new Map<string, string>();
  const topicByName = new Map<string, string>();
  (allTopics ?? []).forEach((t) => {
    topicBySlug.set(t.slug as string, t.id as string);
    topicByName.set(String(t.name).toLowerCase(), t.id as string);
  });

  for (const row of summaries) {
    const ent = (row.entities ?? {}) as { people?: string[]; organizations?: string[]; locations?: string[] };
    const topicNames = Array.isArray(row.topics) ? (row.topics as string[]) : [];

    // Collect entity ids
    const entIds: string[] = [];
    for (const [type, names] of Object.entries({ person: ent.people, organization: ent.organizations, location: ent.locations })) {
      for (const name of (names ?? []).slice(0, 10)) {
        const id = await upsertEntity(name, type);
        if (id) { entIds.push(id); report.entitiesUpserted++; }
      }
    }

    // Pairwise entity links
    for (let i = 0; i < entIds.length; i++) {
      for (let j = i + 1; j < entIds.length; j++) {
        await linkEntitiesPair(entIds[i], entIds[j]);
        report.entityLinks++;
      }
    }

    // Topic ids
    const topicIds = topicNames
      .map((n) => topicByName.get(n.toLowerCase()) ?? topicBySlug.get(slugify(n)) ?? null)
      .filter((v): v is string => !!v);

    // Topic <-> entity
    for (const tid of topicIds) {
      for (const eid of entIds) await linkTopicEntity(tid, eid);
    }
    // Topic <-> topic pairs
    for (let i = 0; i < topicIds.length; i++) {
      for (let j = i + 1; j < topicIds.length; j++) {
        await linkTopicsPair(topicIds[i], topicIds[j]);
        report.topicLinks++;
      }
    }
    report.summariesProcessed++;
  }
  return report;
}
