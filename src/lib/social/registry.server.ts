/**
 * Runtime registry that maps a `sources` row (kind='social') to a concrete
 * SocialProvider instance. Adding a new social platform means adding one
 * factory here — the ingest pipeline itself never changes.
 */
import type { SocialProvider } from "@/lib/providers/contracts";
import { createRedditProvider } from "./providers/reddit.server";

export interface SocialSourceRow {
  id: string;
  key: string;
  name: string;
  base_url: string | null;
  enabled: boolean;
  retry_count: number;
}

export function resolveSocialProvider(row: SocialSourceRow): SocialProvider | null {
  if (!row.base_url) return null;
  if (row.key.startsWith("reddit-")) {
    return createRedditProvider({ key: row.key, displayName: row.name, url: row.base_url });
  }
  return null;
}
