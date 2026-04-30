export const APP_THEMES = ["classic", "rainbow", "minimal"] as const;

export type AppTheme = (typeof APP_THEMES)[number];

export function normalizeAppTheme(value: string | null | undefined): AppTheme {
  if (value === "minimal") return "minimal";
  return value === "classic" ? "classic" : "rainbow";
}

export function getAppThemeBodyClass(theme: string | null | undefined) {
  const normalized = normalizeAppTheme(theme);
  if (normalized === "minimal") return "app-theme-minimal";
  return normalized === "rainbow" ? "app-theme-rainbow" : "app-theme-classic";
}

export const APP_THEME_OPTIONS: Array<{ value: AppTheme; label: string; description: string }> = [
  {
    value: "classic",
    label: "Classic",
    description: "Current warm Democracy Routes theme."
  },
  {
    value: "rainbow",
    label: "Rainbow",
    description: "High-color theme with brighter accents and vivid gradients."
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Black and white theme with restrained contrast and no color accents."
  }
];
