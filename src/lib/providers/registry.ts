import type { AnyProvider, ProviderKind } from "./contracts";

/**
 * Provider registry. Concrete providers register themselves here at boot.
 * The rest of the system talks to the registry — never to concrete impls.
 * No providers are wired yet. Register real implementations before ingestion.
 */
class ProviderRegistry {
  private providers = new Map<string, AnyProvider>();

  register(provider: AnyProvider): void {
    this.providers.set(provider.key, provider);
  }

  get(key: string): AnyProvider | undefined {
    return this.providers.get(key);
  }

  listByKind(kind: ProviderKind): AnyProvider[] {
    return Array.from(this.providers.values()).filter((p) => p.kind === kind);
  }

  list(): AnyProvider[] {
    return Array.from(this.providers.values());
  }
}

export const providerRegistry = new ProviderRegistry();
