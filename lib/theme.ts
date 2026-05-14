// Terminal Pro design tokens — shared with SVG charts and inline-style code
// where Tailwind utilities don't cover the case (charts, dynamic strokes, etc).
export const T = {
  bg: "#0a0a0a",
  bgEl: "#111111",
  bgEl2: "#0e0e0e",
  div: "#1e1e1e",
  text: "#b0b0b0",
  dim: "#484848",
  muted: "#666666",
  bright: "#e8e8e8",
  green: "#00d49a",
  red: "#ff5252",
  amber: "#ffaa33",
  blue: "#5b8af8",
  mono: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, monospace",
} as const;
