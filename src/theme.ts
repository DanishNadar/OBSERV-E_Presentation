// Shared color tokens for canvas, SVG and three.js (CSS mirrors these in global.css)
export const colors = {
  void: "#04050d",
  ink: "#0a0f1f",
  text: "#eef3fa",
  dim: "#9aa8c2",
  cyan: "#3fe0ff",
  indigo: "#7a7dff",
  violet: "#b27bff",
  magenta: "#ff5fd2",
  amber: "#ffb547",
  orange: "#ff8a3d",
  red: "#ff4d5e",
  green: "#34e0a1",
  lime: "#b6f35a",
  sky: "#5fb4ff",
  // Brand colors sampled from the OBSERV-E logo
  brandPurple: "#5e2590",
  brandViolet: "#7a44a0",
  brandLens: "#6767db",
  // Robot shell color sampled from the prototype
  shell: "#f5a030",
} as const;

export type ColorName = keyof typeof colors;

// Pipeline motif shown on the opening and closing slides
export const motif = [
  { name: "Perception", color: colors.cyan, blurb: "See the scene" },
  { name: "Tracking", color: colors.green, blurb: "Lock onto one person" },
  { name: "Prediction", color: colors.amber, blurb: "Lead their motion" },
  { name: "Understanding", color: colors.violet, blurb: "Judge what matters" },
  { name: "Communication", color: colors.magenta, blurb: "Say it clearly" },
  { name: "Action", color: colors.orange, blurb: "Move with them" },
] as const;

// Hex to rgba helper for canvas strokes
export const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
