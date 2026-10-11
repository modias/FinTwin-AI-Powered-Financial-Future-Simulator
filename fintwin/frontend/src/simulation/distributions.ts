/**
 * Probability distributions used by the engine.
 */

import type { RandomSource } from "@/simulation/random";

/**
 * Parameters of a lognormal multiplier with mean 1 and coefficient of
 * variation `variation`: `exp(mu + sigma · Z)` with `sigma² = ln(1 + cv²)`
 * and `mu = −sigma² / 2`. The result is always positive and right-skewed —
 * spending can run well over an estimate but never below zero — and a
 * variation of 0 gives exactly 1.
 */
export function lognormalParameters(variation: number): { mu: number; sigma: number } {
  if (!(variation >= 0)) {
    throw new Error(`Variation must be non-negative, got ${variation}`);
  }

  const sigmaSquared = Math.log(1 + variation * variation);

  return { mu: -sigmaSquared / 2, sigma: Math.sqrt(sigmaSquared) };
}

/** A lognormal multiplier for a given standard normal draw `z`. */
export function lognormalMultiplier(variation: number, z: number): number {
  if (variation === 0) return 1;

  const { mu, sigma } = lognormalParameters(variation);

  return Math.exp(mu + sigma * z);
}

/** A non-negative whole-cent amount: `expected × multiplier`, rounded. */
export function sampleAmountCents(expectedCents: number, multiplier: number): number {
  return Math.max(0, Math.round(expectedCents * multiplier));
}

/**
 * A Poisson-distributed count by inversion of one uniform draw. Exact for
 * the small daily rates the emergency model uses.
 */
export function poissonFromUniform(rate: number, uniform: number): number {
  if (rate <= 0) return 0;

  let probability = Math.exp(-rate);
  let cumulative = probability;
  let count = 0;

  while (uniform >= cumulative && count < 50) {
    count += 1;
    probability *= rate / count;
    cumulative += probability;
  }

  return count;
}

/** Convenience for callers holding a random source. */
export function samplePoisson(rate: number, random: RandomSource): number {
  return poissonFromUniform(rate, random.next());
}
