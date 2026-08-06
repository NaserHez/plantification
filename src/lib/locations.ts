const KEY = "garden_custom_locations";

export const BUILT_IN_LOCATIONS = ["indoor", "outdoor", "balcony", "windowsill"];

export function getCustomLocations(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((l) => typeof l === "string") : [];
  } catch {
    return [];
  }
}

export function addCustomLocation(name: string): string[] {
  const clean = name.trim();
  if (!clean) return getCustomLocations();
  const existing = getCustomLocations();
  const exists =
    existing.some((l) => l.toLowerCase() === clean.toLowerCase()) ||
    BUILT_IN_LOCATIONS.includes(clean.toLowerCase());
  const next = exists ? existing : [...existing, clean];
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function removeCustomLocation(name: string): string[] {
  const next = getCustomLocations().filter((l) => l !== name);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function formatLocation(loc: string): string {
  return loc.charAt(0).toUpperCase() + loc.slice(1);
}
