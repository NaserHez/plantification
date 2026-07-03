// Unit conversion + formatting helpers for the "metric" / "imperial" preference
// stored on `profiles.unit_system`. Cached in localStorage for offline use.

export type UnitSystem = "metric" | "imperial";

const KEY = "unit_system_v1";

export function getUnitSystem(): UnitSystem {
  if (typeof window === "undefined") return "metric";
  const v = window.localStorage.getItem(KEY);
  return v === "imperial" ? "imperial" : "metric";
}

export function setUnitSystem(next: UnitSystem) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, next);
  window.dispatchEvent(new CustomEvent("unit-system-change", { detail: next }));
}

/** Subscribe to changes made via setUnitSystem or storage events (multi-tab). */
export function onUnitSystemChange(cb: (u: UnitSystem) => void): () => void {
  const handler = () => cb(getUnitSystem());
  window.addEventListener("unit-system-change", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("unit-system-change", handler);
    window.removeEventListener("storage", handler);
  };
}

// --- Conversions ---
export const cToF = (c: number) => (c * 9) / 5 + 32;
export const kmhToMph = (k: number) => k * 0.621371;
export const mmToIn = (mm: number) => mm / 25.4;
export const cmToIn = (cm: number) => cm / 2.54;

// --- Formatters ---
export function formatTemp(c: number, unit: UnitSystem = getUnitSystem()): string {
  return unit === "imperial" ? `${Math.round(cToF(c))}°F` : `${Math.round(c)}°C`;
}

export function formatWind(kmh: number, unit: UnitSystem = getUnitSystem()): string {
  return unit === "imperial"
    ? `${Math.round(kmhToMph(kmh))} mph`
    : `${Math.round(kmh)} km/h`;
}

export function formatLength(cm: number, unit: UnitSystem = getUnitSystem()): string {
  return unit === "imperial"
    ? `${cmToIn(cm).toFixed(1)} in`
    : `${cm.toFixed(1)} cm`;
}

export function formatRain(mm: number, unit: UnitSystem = getUnitSystem()): string {
  return unit === "imperial"
    ? `${mmToIn(mm).toFixed(2)} in`
    : `${mm.toFixed(1)} mm`;
}
