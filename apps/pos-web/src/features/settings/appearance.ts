export type AppearancePreference = "system" | "light" | "dark";

export const APPEARANCE_STORAGE_KEY = "cetech-pos-appearance";

export function readStoredAppearance(): AppearancePreference {
  if (typeof window === "undefined") {
    return "system";
  }
  const value = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

export function applyAppearance(appearance: AppearancePreference): void {
  if (typeof document === "undefined") {
    return;
  }
  if (appearance === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else if (appearance === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
  }
}
