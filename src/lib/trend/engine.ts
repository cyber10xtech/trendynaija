/**
 * Trend Engine — framework only.
 * Real inputs are supplied once ingestion is connected.
 *
 * TrendScore = weighted composition of signal features.
 * Weights are configurable per deployment via system_settings.
 */

export interface TrendSignals {
  mentionVolume: number;
  growthVelocity: number;
  sourceDiversity: number;
  newsCoverage: number;
  searchInterest: number;
  freshness: number;
}

export interface TrendWeights {
  mentionVolume: number;
  growthVelocity: number;
  sourceDiversity: number;
  newsCoverage: number;
  searchInterest: number;
  freshness: number;
}

export const defaultWeights: TrendWeights = {
  mentionVolume: 0.25,
  growthVelocity: 0.25,
  sourceDiversity: 0.15,
  newsCoverage: 0.15,
  searchInterest: 0.15,
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
      signals.freshness * w.freshness;
    return { score: raw, confidence, signals };
  }
}

export const trendEngine = new TrendEngine();
