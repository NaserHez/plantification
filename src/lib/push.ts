import { supabase } from "@/integrations/supabase/client";

// Public VAPID key — safe to embed in client.
// Paired with the VAPID_PRIVATE_KEY edge-function secret.
export const VAPID_PUBLIC_KEY =
  "BNTOUyNKwCnybWwaXY5taN1HNIUNX8ykl3MuA-Ck5WRLp0T1NE1jutcxpbZrqOedoUPgmg5wSHUdl5cSWsDY-20";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Ensure a push subscription exists and is mirrored into push_subscriptions. */
export async function ensurePushSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (Notification.permission !== "granted") return false;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    } catch (err) {
      console.warn("[push] subscribe failed", err);
      return false;
    }
  }

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return false;

  const reminderTime = localStorage.getItem("reminder_time") || "08:00";
  const tone = localStorage.getItem("notif_tone") || "default";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const p256dh = arrayBufferToBase64(sub.getKey("p256dh"));
  const authKey = arrayBufferToBase64(sub.getKey("auth"));

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: p256dh,
        auth: authKey,
        reminder_time: reminderTime,
        timezone,
        tone,
        enabled: true,
      },
      { onConflict: "endpoint" }
    );
  if (error) {
    console.warn("[push] save subscription failed", error);
    return false;
  }
  return true;
}

/** Update server-side reminder settings for the current subscription(s). */
export async function syncPushSettings(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const reminderTime = localStorage.getItem("reminder_time") || "08:00";
  const tone = localStorage.getItem("notif_tone") || "default";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  await supabase
    .from("push_subscriptions")
    .update({ reminder_time: reminderTime, tone, timezone })
    .eq("endpoint", sub.endpoint);
}

export async function disablePushSubscription(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await supabase
    .from("push_subscriptions")
    .update({ enabled: false })
    .eq("endpoint", sub.endpoint);
}
