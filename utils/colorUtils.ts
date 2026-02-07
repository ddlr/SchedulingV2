import { getClientColorPalette } from '../constants';

/**
 * Returns a stable color from the configured palette for a given ID.
 * When allClientIds is provided, uses index-based assignment to guarantee
 * unique colors (up to palette size) instead of hashing which suffers from
 * birthday-problem collisions.
 */
export const getClientColor = (id: string, allClientIds?: string[]): string => {
  const palette = getClientColorPalette();
  if (!palette || palette.length === 0) {
    return '#3B82F6';
  }

  // Deduplicate the palette at runtime to avoid same-color assignments
  const uniquePalette = [...new Set(palette)];

  // Index-based assignment: sort all IDs deterministically, assign by position
  if (allClientIds && allClientIds.length > 0) {
    const sorted = [...allClientIds].sort();
    const index = sorted.indexOf(id);
    if (index >= 0) return uniquePalette[index % uniquePalette.length];
  }

  // Fallback: FNV-1a hash (better distribution than DJB2 for UUIDs)
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return uniquePalette[((hash >>> 0) % uniquePalette.length)];
};

/**
 * Determines whether black or white text should be used on a given background color for better contrast.
 */
export const getContrastText = (hexcolor: string): string => {
  if (!hexcolor) return '#1E293B';
  const hex = hexcolor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#1E293B' : '#FFFFFF';
};
