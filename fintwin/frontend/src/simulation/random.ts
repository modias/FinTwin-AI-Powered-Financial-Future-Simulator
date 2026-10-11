/**
 * Seeded pseudo-random numbers.
 *
 * The generator is sfc32 (Chris Doty-Humphrey's Small Fast Counting
 * generator): 128 bits of state, a period of at least 2^32 and good
 * statistical quality for simulation. It is seeded through splitmix32 so that
 * neighbouring seeds produce unrelated sequences.
 *
 * Every path gets its own independent stream per component, derived from
 * `(seed, path, stream)`. So path 17's spending draws are the same whether
 * 1,000 or 10,000 paths run, and turning unexpected expenses on or off does
 * not change anyone's spending draws. Identical seeds give identical results.
 */

/** Separate streams for each random component of a path. */
export const RANDOM_STREAMS = {
  spending: 1,
  emergencies: 2,
} as const;

export type RandomStream = (typeof RANDOM_STREAMS)[keyof typeof RANDOM_STREAMS];

export interface RandomSource {
  /** Uniform on `[0, 1)`. */
  next(): number;
  /** Standard normal (mean 0, standard deviation 1). */
  nextNormal(): number;
}

/** Mixes 32-bit integers into one well-distributed 32-bit seed (murmur3 finaliser). */
export function mixSeed(...parts: number[]): number {
  let hash = 0x9e3779b9;

  for (const part of parts) {
    hash ^= part >>> 0;
    hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
    hash ^= hash >>> 16;
  }

  return hash >>> 0;
}

function splitmix32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x9e3779b9) | 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);

    return (z ^ (z >>> 16)) >>> 0;
  };
}

export function createRandom(seed: number): RandomSource {
  const init = splitmix32(seed);
  let a = init();
  let b = init();
  let c = init();
  let d = init();

  function nextUint32(): number {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;

    return t >>> 0;
  }

  // Discard the first outputs, as recommended for sfc32.
  for (let index = 0; index < 12; index += 1) nextUint32();

  let spareNormal: number | null = null;

  return {
    next: () => nextUint32() / 4_294_967_296,

    // Box–Muller, keeping the second value of each pair.
    nextNormal() {
      if (spareNormal !== null) {
        const value = spareNormal;
        spareNormal = null;

        return value;
      }

      // `1 − u` is in (0, 1], so the logarithm is finite.
      const radius = Math.sqrt(-2 * Math.log(1 - nextUint32() / 4_294_967_296));
      const angle = (2 * Math.PI * nextUint32()) / 4_294_967_296;
      spareNormal = radius * Math.sin(angle);

      return radius * Math.cos(angle);
    },
  };
}

/** The stream for one component of one path. */
export function pathRandom(seed: number, pathIndex: number, stream: RandomStream): RandomSource {
  return createRandom(mixSeed(seed, pathIndex, stream));
}
