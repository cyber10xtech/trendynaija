/**
 * Modular AI pipeline for Trendy Naija.
 *
 * Each stage is a replaceable service that operates on the shared
 * PipelineContext. Stages can be enabled, disabled, and reordered
 * without touching the rest of the system.
 */

export interface PipelineItem {
  id: string;
  title: string;
  content?: string;
  source?: string;
  publishedAt?: string;
  language?: string;
}

export interface PipelineContext {
  items: PipelineItem[];
  extractedTopics?: string[];
  extractedHashtags?: string[];
  clusters?: Array<{ id: string; itemIds: string[] }>;
  sentiments?: Array<{ itemId: string; sentiment: "positive" | "neutral" | "negative"; score: number }>;
  entities?: Array<{ itemId: string; entities: string[] }>;
  summaries?: Array<{ subjectId: string; summary: string }>;
  metadata: Record<string, unknown>;
}

export interface AIStage {
  readonly name: string;
  readonly enabled: boolean;
  run(ctx: PipelineContext): Promise<PipelineContext>;
}

// Stage contract stubs — real implementations plug in later.
export interface TopicExtractionService extends AIStage { name: "topic_extraction" }
export interface HashtagExtractionService extends AIStage { name: "hashtag_extraction" }
export interface DeduplicationService extends AIStage { name: "deduplication" }
export interface ClusteringService extends AIStage { name: "clustering" }
export interface SentimentService extends AIStage { name: "sentiment" }
export interface EntityRecognitionService extends AIStage { name: "entity_recognition" }
export interface SummaryService extends AIStage { name: "summary" }
export interface TrendScoringService extends AIStage { name: "trend_scoring" }
export interface PredictionService extends AIStage { name: "prediction" }

export class AIPipeline {
  private stages: AIStage[] = [];

  register(stage: AIStage): this {
    this.stages.push(stage);
    return this;
  }

  async run(initial: PipelineItem[]): Promise<PipelineContext> {
    let ctx: PipelineContext = { items: initial, metadata: {} };
    for (const stage of this.stages) {
      if (!stage.enabled) continue;
      ctx = await stage.run(ctx);
    }
    return ctx;
  }

  listStages() {
    return this.stages.map((s) => ({ name: s.name, enabled: s.enabled }));
  }
}

export const aiPipeline = new AIPipeline();
