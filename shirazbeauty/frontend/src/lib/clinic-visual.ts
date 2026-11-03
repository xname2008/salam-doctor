/**
 * Visual helpers for clinic cards and detail heroes when a photo is missing.
 * Palettes and motifs stay deterministic so the same clinic always matches.
 * Never derive letter-monograms from Persian names — Farsi initials look
 * unprofessional when sliced like Latin acronyms.
 */

export const CLINIC_COVER_TONES = [
  "rose",
  "mauve",
  "champagne",
  "terracotta",
  "dusk",
] as const;

export type ClinicCoverTone = (typeof CLINIC_COVER_TONES)[number];

export const CLINIC_COVER_MOTIFS = ["petal", "sparkle", "blossom"] as const;

export type ClinicCoverMotif = (typeof CLINIC_COVER_MOTIFS)[number];

function hashSeed(seed: string | number): number {
  const text = String(seed);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function clinicCoverTone(seed: string | number): ClinicCoverTone {
  return CLINIC_COVER_TONES[hashSeed(seed) % CLINIC_COVER_TONES.length]!;
}

export function clinicCoverMotif(seed: string | number): ClinicCoverMotif {
  return CLINIC_COVER_MOTIFS[hashSeed(`motif:${seed}`) % CLINIC_COVER_MOTIFS.length]!;
}
