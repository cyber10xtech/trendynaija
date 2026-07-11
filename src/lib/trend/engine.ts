/**
 * Trend Engine — framework-only scoring.
 *
 * TrendScore = weighted composition of signal features from all providers:
 *   - news (news providers)
 *   - search interest (Google Trends)
 *   - social activity (Reddit + future SocialProviders)
 * Weights are configurable per deployment via system_settings.
 */

export interface TrendSignals {
  mentionVolume: number;
  growthVelocity: number;
  sourceDiversity: number;
  newsCoverage: number;
  searchInterest: number;
  socialActivity: number;
  freshness: number;
}

export interface TrendWeights {
  mentionVolume: number;
  growthVelocity: number;
  sourceDiversity: number;
  newsCoverage: number;
  searchInterest: number;
  socialActivity: number;
  freshness: number;
}

export const defaultWeights: TrendWeights = {
  mentionVolume: 0.20,
  growthVelocity: 0.20,
  sourceDiversity: 0.12,
  newsCoverage: 0.15,
  searchInterest: 0.15,
  socialActivity: 0.13,
  freshness: 0.05,
};

export interface TrendScoreResult {
  score: number;
  confidence: number;
  signals: TrendSignals;
}

export class TrendEngine {
  constructor(private weights: TrendWeights = defaultWeights) {}

  score(signals: TrendSignals, confidence = 0): TrendScoreResult {
    const w = this.weights;
    const raw =
      signals.mentionVolume * w.mentionVolume +
      signals.growthVelocity * w.growthVelocity +
      signals.sourceDiversity * w.sourceDiversity +
      signals.newsCoverage * w.newsCoverage +
      signals.searchInterest * w.searchInterest +
      signals.socialActivity * w.socialActivity +
      signals.freshness * w.freshness;
    return { score: raw, confidence, signals };
  }
}

export const trendEngine = new TrendEngine();
