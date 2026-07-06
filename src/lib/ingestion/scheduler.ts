/**
 * Ingestion scheduler framework.
 * Real cron jobs will call server routes that use this scheduler
 * to run the registered providers and persist their output.
 */

import type { AnyProvider } from "@/lib/providers/contracts";

export interface JobHandle {
  jobId: string;
  sourceKey: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  startedAt?: string;
  finishedAt?: string;
  itemsIngested: number;
  retryCount: number;
  error?: string;
}

export interface IngestionJobRunner {
  run(provider: AnyProvider): Promise<JobHandle>;
}
