export type Tier = 'low' | 'medium' | 'high';

export interface QualityConfig {
  tier: Tier;
  maxPixelRatio: number;
  minPixelRatio: number;
  fogOctaves: number;
  sprites: number;
  dust: number;
  rain: number;
  ring: number;
  antialias: boolean;
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const isCoarsePointer = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export function detectQuality(): QualityConfig {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const mobile = isCoarsePointer() || small;
  let tier: Tier = 'high';
  if (mobile || cores <= 2 || mem <= 2) tier = 'low';
  else if (cores <= 4 || mem <= 4) tier = 'medium';
  const dpr = window.devicePixelRatio || 1;
  switch (tier) {
    case 'low':
      return { tier, maxPixelRatio: Math.min(dpr, 1.25), minPixelRatio: 0.55, fogOctaves: 3, sprites: 8, dust: 600, rain: 320, ring: 900, antialias: false };
    case 'medium':
      return { tier, maxPixelRatio: Math.min(dpr, 1.5), minPixelRatio: 0.6, fogOctaves: 4, sprites: 14, dust: 1200, rain: 600, ring: 1800, antialias: false };
    default:
      return { tier, maxPixelRatio: Math.min(dpr, 2), minPixelRatio: 0.7, fogOctaves: 5, sprites: 24, dust: 2200, rain: 1000, ring: 3200, antialias: true };
  }
}
