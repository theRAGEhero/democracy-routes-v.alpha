export const DEFAULT_DATASPACE_COLOR = "#f97316";

export const DATASPACE_COLOR_OPTIONS = [
  { label: "Civic Orange", value: "#f97316" },
  { label: "Sunset Coral", value: "#fb7185" },
  { label: "Consensus Red", value: "#ef4444" },
  { label: "Civic Maroon", value: "#be123c" },
  { label: "Evidence Amber", value: "#f59e0b" },
  { label: "Forum Gold", value: "#eab308" },
  { label: "Civic Green", value: "#22c55e" },
  { label: "Growth Lime", value: "#84cc16" },
  { label: "Commons Teal", value: "#14b8a6" },
  { label: "Harbor Aqua", value: "#06b6d4" },
  { label: "Deliberation Blue", value: "#2563eb" },
  { label: "Commons Indigo", value: "#6366f1" },
  { label: "Midnight Blue", value: "#0f172a" },
  { label: "Public Violet", value: "#8b5cf6" },
  { label: "Civic Plum", value: "#a855f7" },
  { label: "Town Hall Pink", value: "#ec4899" },
  { label: "Slate", value: "#64748b" }
];

export function normalizeHexColor(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function pickDataspaceColor(value?: string | null) {
  return normalizeHexColor(value) ?? DEFAULT_DATASPACE_COLOR;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const num = Number.parseInt(normalized, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function shadeChannel(value: number, factor: number) {
  return Math.max(0, Math.min(255, Math.round(value * factor)));
}

function shadeColor({ r, g, b }: { r: number; g: number; b: number }, factor: number) {
  return {
    r: shadeChannel(r, factor),
    g: shadeChannel(g, factor),
    b: shadeChannel(b, factor)
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getDataspaceTheme(color?: string | null) {
  const base = pickDataspaceColor(color);
  const rgb = hexToRgb(base);
  const deep = rgbToHex(shadeColor(rgb, 0.7));
  return {
    "--dataspace-accent": base,
    "--dataspace-accent-deep": deep,
    "--dataspace-wash": `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`,
    "--dataspace-wash-2": `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.09)`,
    "--dataspace-stroke": `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`,
    "--dataspace-card": "rgba(255, 255, 255, 0.82)"
  } as Record<string, string>;
}
