/** #rrggbb → [h, s%, l%] */
export function hexToHsl(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [243, 75, 56];
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = Math.round((h * 60 + 360) % 360);
  const l = (max + min) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return [h, Math.round(s * 100), Math.round(l * 100)];
}
export const ACCENTS = [
  { name: 'Indigo', value: '#4f46e5' }, { name: 'Blue', value: '#2563eb' }, { name: 'Violet', value: '#7c3aed' },
  { name: 'Teal', value: '#0d9488' }, { name: 'Emerald', value: '#059669' }, { name: 'Rose', value: '#e11d48' },
  { name: 'Orange', value: '#ea580c' }, { name: 'Slate', value: '#334155' },
];
