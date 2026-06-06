import { supabase } from "@/integrations/supabase/client";

let cachedPublicKey: string | null = null;

async function getVapidPublicKey(): Promise<string> {
  if (cachedPublicKey) return cachedPublicKey;
  const { data, error } = await supabase.functions.invoke("send-watering-reminders", {
    method: "GET" as any,
    body: undefined,
  } as any);
  // Fallback: call directly via fetch since invoke doesn't pass query params
  if (!data || !data.publicKey) {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-watering-reminders?action=publicKey`;
    const res = await fetch(url, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    });
    const json = await res.json();
    cachedPublicKey = json.publicKey || "";
  } else {
    cachedPublicKey = data.publicKey;
  }
  if (!cachedPublicKey) throw new Error("VAPID public key not available");
  return cachedPublicKey;
}

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

export function getReminderTimezone(): string {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const saved = localStorage.getItem("reminder_timezone");
  if (saved && saved !== detected) localStorage.setItem("reminder_timezone", detected);
  if (!saved) localStorage.setItem("reminder_timezone", detected);
  return detected;
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
      const publicKey = await getVapidPublicKey();
      const key = urlBase64ToUint8Array(publicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
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
  const timezone = getReminderTimezone();
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
  const timezone = getReminderTimezone();
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

export interface TestPushResult {
  ok: boolean;
  error?: string;
  results?: Array<{ id: string; sent?: boolean; error?: string; status?: number }>;
  total?: number;
  sentCount?: number;
  failedCount?: number;
}

/** Trigger an immediate test push to the current user's subscriptions. */
export async function sendTestPush(): Promise<TestPushResult> {
  try {
    await ensurePushSubscription();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return { ok: false, error: "Not signed in" };
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-watering-reminders?action=test`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
    });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok) return { ok: false, error: json?.error || `HTTP ${res.status}` };
    const results: TestPushResult["results"] = Array.isArray(json?.results) ? json.results : [];
    const sentCount = results.filter((r) => r.sent).length;
    const failedCount = results.filter((r) => !r.sent).length;
    return { ok: true, results, total: results.length, sentCount, failedCount };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}


