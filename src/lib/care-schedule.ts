// Care schedule utilities — seasonal auto-adjust + next-due math.
// Purely functional so it's easy to unit-test.

export type CareTask = "water" | "fertilize" | "mist" | "repot";

export interface Schedule {
  id?: string;
  plant_id: string;
  user_id?: string;
  task_type: CareTask;
  interval_days: number;
  next_due_at: string; // ISO
  last_done_at?: string | null;
  is_paused: boolean;
  notes?: string | null;
}

/**
 * Seasonal multiplier — Northern-hemisphere approximation.
 * Summer plants (Jun–Aug) drink faster → shorter interval (×0.8).
 * Winter (Dec–Feb) → longer interval (×1.4). Fertilizing pauses in winter.
 */
export function seasonalMultiplier(task: CareTask, date = new Date()): number {
  const m = date.getMonth(); // 0-11
  const summer = m >= 5 && m <= 7;
  const winter = m === 11 || m <= 1;

  if (task === "water" || task === "mist") {
    if (summer) return 0.8;
    if (winter) return 1.4;
    return 1;
  }
  if (task === "fertilize") {
    if (winter) return 3; // effectively skip
    if (summer) return 0.9;
    return 1;
  }
  // repot rarely — no seasonal adjust
  return 1;
}

export function computeNextDue(
  task: CareTask,
  intervalDays: number,
  lastDoneAt: Date = new Date(),
): Date {
  const factor = seasonalMultiplier(task, lastDoneAt);
  const days = Math.max(1, Math.round(intervalDays * factor));
  return new Date(lastDoneAt.getTime() + days * 86400000);
}

export function daysUntil(iso: string, now = new Date()): number {
  const t = new Date(iso).getTime();
  return Math.ceil((t - now.getTime()) / 86400000);
}

export function defaultIntervalFor(task: CareTask, wateringFrequency?: string | null): number {
  const wateringDays: Record<string, number> = {
    daily: 1,
    "every-2-days": 2,
    weekly: 7,
    biweekly: 14,
    monthly: 30,
  };
  switch (task) {
    case "water":
      return wateringDays[wateringFrequency || "weekly"] || 7;
    case "fertilize":
      return 30;
    case "mist":
      return 3;
    case "repot":
      return 365;
  }
}

export const TASK_META: Record<CareTask, { label: string; icon: string; tone: string }> = {
  water: { label: "Water", icon: "💧", tone: "text-water" },
  fertilize: { label: "Fertilize", icon: "🌱", tone: "text-healthy" },
  mist: { label: "Mist", icon: "💨", tone: "text-bloom" },
  repot: { label: "Repot", icon: "🪴", tone: "text-soil" },
};
