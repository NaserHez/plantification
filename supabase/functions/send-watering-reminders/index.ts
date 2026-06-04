import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const frequencyToDays: Record<string, number> = {
  daily: 1,
  "every-2-days": 2,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

function localDateParts(date: Date, tz: string): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
  return { y: get("year"), m: get("month"), d: get("day") };
}

function localDayNumber(date: Date, tz: string): number {
  const { y, m, d } = localDateParts(date, tz);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function getOverduePlants(plants: Array<{ name: string; nickname: string | null; last_watered: string | null; watering_frequency: string | null }>, tz: string) {
  const today = localDayNumber(new Date(), tz);
  const overdue: Array<{ name: string; nickname: string | null; daysOverdue: number }> = [];
  for (const p of plants) {
    if (!p.last_watered || !p.watering_frequency) continue;
    const lastDay = localDayNumber(new Date(p.last_watered), tz);
    const days = today - lastDay;
    const interval = frequencyToDays[p.watering_frequency] || 7;
    const daysOverdue = days - interval;
    if (daysOverdue >= 0) overdue.push({ name: p.name, nickname: p.nickname, daysOverdue });
  }
  return overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/** Returns the user's local HH:mm string for a given IANA timezone. */
function localTimeHHMM(tz: string): { hhmm: string; ymd: string } {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts = fmt.formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    const hh = get("hour").padStart(2, "0");
    const mm = get("minute").padStart(2, "0");
    return { hhmm: `${hh}:${mm}`, ymd: `${get("year")}-${get("month")}-${get("day")}` };
  } catch {
    const d = new Date();
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    return { hhmm: `${hh}:${mm}`, ymd };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || "";
    const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";

    const url = new URL(req.url);
    if (url.searchParams.get("action") === "publicKey") {
      return new Response(JSON.stringify({ publicKey: VAPID_PUBLIC }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!VAPID_PRIVATE || !VAPID_PUBLIC) {
      return new Response(JSON.stringify({ error: "VAPID keys not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    webpush.setVapidDetails("mailto:reminders@plantification.app", VAPID_PUBLIC, VAPID_PRIVATE);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Optional debug: ?dryRun=1 returns the plan without sending
    const dryRun = url.searchParams.get("dryRun") === "1";
    // Optional: ?userId=... to force-send to one user (for testing from the app)
    const forceUserId = url.searchParams.get("userId");

    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, reminder_time, timezone, enabled, last_sent_date");
    if (error) throw error;

    const candidates: typeof subs = [];
    for (const s of subs || []) {
      if (!s.enabled) continue;
      if (forceUserId && s.user_id !== forceUserId) continue;
      const { hhmm, ymd } = localTimeHHMM(s.timezone || "UTC");
      const target = (s.reminder_time || "08:00").slice(0, 5);
      // Window: target time .. target+10 minutes (cron runs every ~5min)
      const [th, tm] = target.split(":").map(Number);
      const [ch, cm] = hhmm.split(":").map(Number);
      const targetMin = th * 60 + tm;
      const curMin = ch * 60 + cm;
      const diff = curMin - targetMin;
      const inWindow = forceUserId ? true : diff >= 0 && diff <= 10;
      if (!inWindow) continue;
      if (!forceUserId && s.last_sent_date === ymd) continue;
      candidates.push({ ...s, _ymd: ymd } as any);
    }

    const results: any[] = [];
    for (const s of candidates) {
      const { data: plants } = await admin
        .from("plants")
        .select("id, name, nickname, last_watered, watering_frequency")
        .eq("user_id", s.user_id);
      const overduePlants = getOverduePlants((plants || []) as any, s.timezone || "UTC");
      const overdue = overduePlants.length;
      if (overdue === 0) {
        // Still mark as processed today so we don't churn
        await admin.from("push_subscriptions").update({ last_sent_date: (s as any)._ymd }).eq("id", s.id);
        results.push({ user_id: s.user_id, skipped: "no_overdue" });
        continue;
      }
      const names = overduePlants
        .slice(0, 3)
        .map((p: any) => p.nickname || p.name)
        .join(", ");
      const payload = JSON.stringify({
        title: "🌱 Plants need water!",
        body: `${overdue} plant${overdue > 1 ? "s" : ""} overdue${names ? `: ${names}` : ""}`,
        tag: "watering-reminder",
        url: "/notifications",
      });

      if (dryRun) {
        results.push({ user_id: s.user_id, overdue, payload: JSON.parse(payload) });
        continue;
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh || "", auth: s.auth || "" },
          } as any,
          payload,
          { TTL: 60 * 60 * 12, urgency: "normal" }
        );
        await admin.from("push_subscriptions").update({ last_sent_date: (s as any)._ymd }).eq("id", s.id);
        results.push({ user_id: s.user_id, sent: true, overdue });
      } catch (err: any) {
        const status = err?.statusCode;
        // Subscription gone → disable
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").update({ enabled: false }).eq("id", s.id);
        }
        results.push({ user_id: s.user_id, error: err?.message || String(err), status });
      }
    }

    return new Response(
      JSON.stringify({ processed: candidates.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
