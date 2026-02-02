import { getClientColorPalette } from '../constants';

/**
 * Returns a stable color from the configured palette for a given ID.
 */
export const getClientColor = (id: string): string => {
  const palette = getClientColorPalette();
  if (!palette || palette.length === 0) {
    return '#3B82F6';
  }

  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palette.length;
  return palette[index];
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
