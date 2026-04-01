import { useEffect, useState, useRef } from "react";

interface Plant {
  id: string;
  name: string;
  nickname?: string | null;
  last_watered?: string | null;
  watering_frequency?: string | null;
  image_url?: string | null;
}

interface OverduePlant extends Plant {
  daysSinceWatered: number;
  daysOverdue: number;
}

const frequencyToDays: Record<string, number> = {
  daily: 1,
  "every-2-days": 2,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

export function getOverduePlants(plants: Plant[]): OverduePlant[] {
  const now = Date.now();
  return plants
    .filter((p) => p.last_watered && p.watering_frequency)
    .map((p) => {
      const lastWatered = new Date(p.last_watered!).getTime();
      const daysSinceWatered = Math.floor((now - lastWatered) / (1000 * 60 * 60 * 24));
      const intervalDays = frequencyToDays[p.watering_frequency!] || 7;
      const daysOverdue = daysSinceWatered - intervalDays;
      return { ...p, daysSinceWatered, daysOverdue };
    })
    .filter((p) => p.daysOverdue >= 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

function scheduleNextNotification(overduePlants: OverduePlant[]) {
  if (overduePlants.length === 0) return;

  const reminderTime = localStorage.getItem("reminder_time") || "08:00";
  const [hours, minutes] = reminderTime.split(":").map(Number);

  const now = new Date();
  const scheduledTime = new Date();
  scheduledTime.setHours(hours, minutes, 0, 0);

  // If the time has passed today, schedule for tomorrow
  if (scheduledTime.getTime() <= now.getTime()) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }

  const delay = scheduledTime.getTime() - now.getTime();

  // Clear any existing scheduled notification
  const existingTimer = (window as any).__wateringNotifTimer;
  if (existingTimer) clearTimeout(existingTimer);

  (window as any).__wateringNotifTimer = setTimeout(() => {
    const notifiedKey = `notified_scheduled_${new Date().toDateString()}`;
    if (localStorage.getItem(notifiedKey)) return;

    const tone = localStorage.getItem("notif_tone") || "default";
    const names = overduePlants.slice(0, 3).map((p) => p.nickname || p.name).join(", ");
    const firstPlantImage = overduePlants[0]?.image_url;

    const notifOptions: NotificationOptions = {
      body: `${overduePlants.length} plant${overduePlants.length > 1 ? "s" : ""} overdue: ${names}`,
      icon: firstPlantImage || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "watering-reminder-scheduled",
      silent: tone === "silent",
    };

    new Notification("🌱 Plants need water!", notifOptions);
    localStorage.setItem(notifiedKey, "true");

    // Reschedule for next day
    scheduleNextNotification(overduePlants);
  }, delay);
}

export function useWateringReminders(plants: Plant[]) {
  const [overdue, setOverdue] = useState<OverduePlant[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const scheduledRef = useRef(false);

  useEffect(() => {
    if ("Notification" in window) {
      setPermissionGranted(Notification.permission === "granted");
    }
  }, []);

  useEffect(() => {
    const overduePlants = getOverduePlants(plants);
    setOverdue(overduePlants);

    // Send immediate notification on app open (once per day)
    if (permissionGranted && overduePlants.length > 0) {
      const notifiedKey = `notified_${new Date().toDateString()}`;
      const alreadyNotified = localStorage.getItem(notifiedKey);
      if (!alreadyNotified) {
        const names = overduePlants.slice(0, 3).map((p) => p.nickname || p.name).join(", ");
        const tone = localStorage.getItem("notif_tone") || "default";
        const firstPlantImage = overduePlants[0]?.image_url;

        const notifOptions: NotificationOptions = {
          body: `${overduePlants.length} plant${overduePlants.length > 1 ? "s" : ""} overdue: ${names}`,
          icon: firstPlantImage || "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: "watering-reminder",
          silent: tone === "silent",
        };

        new Notification("🌱 Plants need water!", notifOptions);
        localStorage.setItem(notifiedKey, "true");
      }
    }

    // Schedule daily notification at the user's chosen time
    if (permissionGranted && overduePlants.length > 0 && !scheduledRef.current) {
      scheduledRef.current = true;
      scheduleNextNotification(overduePlants);
    }
  }, [plants, permissionGranted]);

  const requestPermission = async () => {
    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      setPermissionGranted(result === "granted");
      return result === "granted";
    }
    return false;
  };

  return { overdue, permissionGranted, requestPermission };
}
