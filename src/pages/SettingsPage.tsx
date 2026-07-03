import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, Moon, Sun, Monitor, User, Lock, Leaf, Loader2, Globe, Bell, BellOff, Languages, Volume2, Clock, Sprout, Wifi, WifiOff, Trash2, CheckCircle2, XCircle, AlertTriangle, Ruler, Shield, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import BottomNav from "@/components/BottomNav";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Language } from "@/i18n/translations";
import { ensurePushSubscription, syncPushSettings, isPushSupported, getReminderTimezone, sendTestPush, type TestPushResult } from "@/lib/push";
import { getUnitSystem, setUnitSystem, type UnitSystem } from "@/lib/units";
import MfaSection from "@/components/MfaSection";
import ReauthDialog from "@/components/ReauthDialog";

const CARE_LANGUAGES = [
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "ar", label: "العربية", flag: "🇸🇦" },
  { value: "pt", label: "Português", flag: "🇵🇹" },
];

const APP_LANGUAGES = [
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "ar", label: "العربية", flag: "🇸🇦" },
  { value: "pt", label: "Português (PT)", flag: "🇵🇹" },
];

const NOTIF_TONES = [
  { value: "default", label: "🔔 Default", labelAr: "🔔 افتراضي", labelPt: "🔔 Predefinido", freq: 800, pattern: [150, 80, 150] },
  { value: "gentle", label: "🌿 Gentle", labelAr: "🌿 لطيف", labelPt: "🌿 Suave", freq: 440, pattern: [200, 100, 200] },
  { value: "chirp", label: "🐦 Chirp", labelAr: "🐦 زقزقة", labelPt: "🐦 Chilrear", freq: 1200, pattern: [60, 40, 60, 40, 80] },
  { value: "drops", label: "💧 Drops", labelAr: "💧 قطرات", labelPt: "💧 Gotas", freq: 600, pattern: [100, 150, 80, 150, 60] },
  { value: "silent", label: "🔇 Silent", labelAr: "🔇 صامت", labelPt: "🔇 Silencioso", freq: 0, pattern: [] },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { t, language: appLanguage, setLanguage: setAppLanguage } = useLanguage();
  const [displayName, setDisplayName] = useState("");
  const [gardenName, setGardenName] = useState("My Garden");
  const [gardenBio, setGardenBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [email, setEmail] = useState("");
  const [careLang, setCareLang] = useState("en");
  const [notifPermission, setNotifPermission] = useState<string>("default");
  const [notifTone, setNotifTone] = useState(() => localStorage.getItem("notif_tone") || "default");
  const [reminderTime, setReminderTime] = useState(() => localStorage.getItem("reminder_time") || "08:00");
  const [reminderTimezone, setReminderTimezone] = useState(() => getReminderTimezone());
  const [aiValidation, setAiValidation] = useState(() => localStorage.getItem("identify_ai_validation") !== "false");
  const [testStatus, setTestStatus] = useState<{ state: "idle" | "sending" | "done"; result?: TestPushResult; at?: Date }>({ state: "idle" });
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [careCacheBusy, setCareCacheBusy] = useState(false);
  const [units, setUnits] = useState<UnitSystem>(() => getUnitSystem());
  const [reauthOpen, setReauthOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const handleSendTestPush = async () => {
    setTestStatus({ state: "sending" });
    const tid = toast.loading("Sending test notification…");
    const r = await sendTestPush();
    toast.dismiss(tid);
    setTestStatus({ state: "done", result: r, at: new Date() });
    if (r.ok && (r.sentCount ?? 0) > 0) toast.success(`Test sent to ${r.sentCount} subscription${r.sentCount === 1 ? "" : "s"}`);
    else if (r.ok) toast.error("No subscriptions received the test push");
    else toast.error(r.error || "Failed to send test");
  };

  const clearCareDataCache = async () => {
    if (!("caches" in window)) {
      toast.error("Cache API not available in this browser");
      return;
    }
    setCareCacheBusy(true);
    try {
      const targets = ["supabase-rest-cache", "supabase-images-cache", "weather-cache"];
      const existing = await caches.keys();
      const toDelete = existing.filter((k) => targets.includes(k));
      await Promise.all(toDelete.map((k) => caches.delete(k)));
      toast.success(
        toDelete.length > 0
          ? `Cleared ${toDelete.length} cached store${toDelete.length === 1 ? "" : "s"}`
          : "No cached care data found"
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to clear care cache");
    } finally {
      setCareCacheBusy(false);
    }
  };

  const toggleAiValidation = (val: boolean) => {
    setAiValidation(val);
    localStorage.setItem("identify_ai_validation", val ? "true" : "false");
    toast.success(t("settingsSaved"));
  };

  const clearIdentifyCache = () => {
    localStorage.removeItem("identify_cache_v1");
    toast.success("Identification cache cleared");
  };

  const clearAppCache = async () => {
    try {
      toast.loading("Clearing app cache…", { id: "clear-app-cache" });
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      toast.success("Cache cleared. Reloading…", { id: "clear-app-cache" });
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("_r", Date.now().toString());
        window.location.replace(url.toString());
      }, 600);
    } catch (e) {
      console.error(e);
      toast.error("Failed to clear cache", { id: "clear-app-cache" });
    }
  };

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, garden_bio, unit_system")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.display_name) setDisplayName(profile.display_name);
      if (profile?.garden_bio) setGardenBio(profile.garden_bio);
      if ((profile as any)?.unit_system) {
        const u = ((profile as any).unit_system === "imperial" ? "imperial" : "metric") as UnitSystem;
        setUnits(u);
        setUnitSystem(u);
      }

      const saved = localStorage.getItem("garden_name");
      if (saved) setGardenName(saved);
      const savedLang = localStorage.getItem("plant_language");
      if (savedLang) setCareLang(savedLang);

      if ("Notification" in window) {
        setNotifPermission(Notification.permission);
      }
      const tz = getReminderTimezone();
      setReminderTimezone(tz);
      if (Notification.permission === "granted") syncPushSettings().catch(() => {});
      setLoading(false);
    };
    load();
  }, []);

  const playTonePreview = (tone: typeof NOTIF_TONES[number]) => {
    if (tone.value === "silent" || tone.freq === 0) return;
    try {
      const ctx = new AudioContext();
      let t = ctx.currentTime;
      tone.pattern.forEach((dur, i) => {
        if (i % 2 === 0) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = tone.freq + (i * 50);
          osc.type = tone.value === "chirp" ? "square" : tone.value === "drops" ? "sine" : "triangle";
          gain.gain.setValueAtTime(0.15, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + dur / 1000);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + dur / 1000);
        }
        t += dur / 1000;
      });
    } catch {}
  };

  const handleToneChange = (tone: string) => {
    setNotifTone(tone);
    localStorage.setItem("notif_tone", tone);
    const toneObj = NOTIF_TONES.find((t) => t.value === tone);
    if (toneObj) playTonePreview(toneObj);
    syncPushSettings().catch(() => {});
    toast.success(t("settingsSaved"));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("profiles").upsert(
        { user_id: user.id, display_name: displayName, garden_bio: gardenBio || null },
        { onConflict: "user_id" }
      );
      if (error) throw error;

      localStorage.setItem("garden_name", gardenName);
      localStorage.setItem("plant_language", careLang);

      toast.success(t("settingsSaved"));
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error(t("passwordMinLength"));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success(t("passwordUpdated"));
      setNewPassword("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestNotifications = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === "granted") {
      const ok = await ensurePushSubscription();
      if (ok) {
        toast.success(t("notifEnabled"));
      } else {
        toast.error(
          isPushSupported()
            ? "Couldn't register for background reminders. Try installing the app to your home screen."
            : "Background reminders aren't supported in this browser."
        );
      }
    } else {
      toast.error("Notification permission denied");
    }
  };

  const handleSignOut = async () => {
    // Clear cached private data before signing out so the next user on a shared
    // device can't see the previous user's plants/journal/images via NetworkFirst fallback.
    try {
      if ("caches" in window) {
        const targets = ["supabase-rest-cache", "supabase-images-cache"];
        await Promise.all(targets.map((n) => caches.delete(n)));
      }
    } catch {
      // best-effort
    }
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleUnitChange = async (next: UnitSystem) => {
    setUnits(next);
    setUnitSystem(next);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").upsert(
          { user_id: user.id, unit_system: next } as any,
          { onConflict: "user_id" }
        );
      }
    } catch { /* offline / non-critical */ }
    toast.success(t("settingsSaved"));
  };

  const performDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { confirm: "DELETE" },
      });
      if (error) throw error;
      if ((data as any)?.deleted) {
        // Clear caches then sign out.
        try {
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
        } catch { /* noop */ }
        await supabase.auth.signOut();
        toast.success("Your account has been deleted");
        navigate("/");
      } else {
        throw new Error("Deletion did not complete");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const getToneLabel = (tone: typeof NOTIF_TONES[number]) => {
    if (appLanguage === "ar") return tone.labelAr;
    if (appLanguage === "pt") return tone.labelPt;
    return tone.label;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-xl hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-serif">{t("settings")}</h1>
      </div>

      <div className="px-4 max-w-md mx-auto space-y-6 mt-2">
        {/* App Language */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="font-serif text-lg flex items-center gap-2">
            <Languages className="w-4 h-4 text-primary" /> {t("appLanguage")}
          </h2>
          <Select value={appLanguage} onValueChange={(v) => setAppLanguage(v as Language)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {APP_LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  <span className="flex items-center gap-2">{lang.flag} {lang.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("appLanguageDesc")}</p>
        </div>

        {/* Theme */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="font-serif text-lg flex items-center gap-2">
            <Sun className="w-4 h-4 text-sun" /> {t("appearance")}
          </h2>
          <Select value={theme || "system"} onValueChange={setTheme}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light"><span className="flex items-center gap-2"><Sun className="w-4 h-4" /> {t("light")}</span></SelectItem>
              <SelectItem value="dark"><span className="flex items-center gap-2"><Moon className="w-4 h-4" /> {t("dark")}</span></SelectItem>
              <SelectItem value="system"><span className="flex items-center gap-2"><Monitor className="w-4 h-4" /> {t("system")}</span></SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Care Tips Language */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="font-serif text-lg flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" /> {t("careTipsLanguage")}
          </h2>
          <Select value={careLang} onValueChange={setCareLang}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CARE_LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  <span className="flex items-center gap-2">{lang.flag} {lang.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("careTipsLangDesc")}</p>
        </div>

        {/* Notifications */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="font-serif text-lg flex items-center gap-2">
            {notifPermission === "granted" ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
            {t("wateringReminders")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {notifPermission === "granted" ? t("notifEnabled") : t("notifDisabled")}
          </p>
          {notifPermission !== "granted" && (
            <Button onClick={handleRequestNotifications} variant="outline" className="w-full rounded-xl h-10 gap-2">
              <Bell className="w-4 h-4" /> {t("enableNotifications")}
            </Button>
          )}

          {/* Notification Tone */}
          {notifPermission === "granted" && (
            <>
              <div className="pt-2 border-t border-border">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Volume2 className="w-3.5 h-3.5" /> {t("notifTone")}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {NOTIF_TONES.map((tone) => (
                    <button
                      key={tone.value}
                      onClick={() => handleToneChange(tone.value)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors border ${
                        notifTone === tone.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border hover:border-primary/30"
                      }`}
                    >
                      {getToneLabel(tone)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5" /> {t("reminderTime")}
                </Label>
                <p className="text-[10px] text-muted-foreground mb-2">{t("reminderTimeDesc")}</p>
                <p className="text-[10px] text-muted-foreground mb-2">Timezone: {reminderTimezone}</p>
                <Input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => {
                    setReminderTime(e.target.value);
                    localStorage.setItem("reminder_time", e.target.value);
                    syncPushSettings().catch(() => {});
                    toast.success(t("settingsSaved"));
                  }}
                  className="rounded-xl h-10 w-32"
                />
              </div>

              <div className="pt-2 border-t border-border space-y-2">
                <Button
                  onClick={handleSendTestPush}
                  disabled={testStatus.state === "sending"}
                  variant="outline"
                  className="w-full rounded-xl h-10 gap-2"
                >
                  {testStatus.state === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                  Send test notification
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Delivers an immediate push to confirm reminders work on this device.
                </p>

                {testStatus.state === "done" && testStatus.result && (
                  <div
                    className={`rounded-xl border p-3 text-xs space-y-1.5 ${
                      testStatus.result.ok && (testStatus.result.sentCount ?? 0) > 0
                        ? "bg-primary/5 border-primary/30"
                        : "bg-destructive/5 border-destructive/30"
                    }`}
                    role="status"
                    aria-live="polite"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium flex items-center gap-1.5">
                        {testStatus.result.ok && (testStatus.result.sentCount ?? 0) > 0 ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-destructive" />
                        )}
                        {testStatus.result.ok
                          ? (testStatus.result.sentCount ?? 0) > 0
                            ? "Test push delivered"
                            : "Test sent but no devices received it"
                          : "Test push failed"}
                      </span>
                      {testStatus.at && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {testStatus.at.toLocaleTimeString()}
                        </span>
                      )}
                    </div>

                    {testStatus.result.ok && (
                      <div className="flex flex-wrap gap-2 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          {testStatus.result.sentCount ?? 0} / {testStatus.result.total ?? 0} delivered
                        </span>
                        {(testStatus.result.failedCount ?? 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                            {testStatus.result.failedCount} failed
                          </span>
                        )}
                      </div>
                    )}

                    {!testStatus.result.ok && testStatus.result.error && (
                      <p className="text-[11px] text-destructive break-words">{testStatus.result.error}</p>
                    )}

                    {testStatus.result.results && testStatus.result.results.some((r) => r.error) && (
                      <details className="text-[10px]">
                        <summary className="cursor-pointer text-muted-foreground">web-push errors</summary>
                        <ul className="mt-1 space-y-1">
                          {testStatus.result.results
                            .filter((r) => r.error)
                            .map((r) => (
                              <li key={r.id} className="font-mono text-destructive break-words">
                                {r.status ? `[${r.status}] ` : ""}{r.error}
                              </li>
                            ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Offline & cached care data */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="font-serif text-lg flex items-center gap-2">
            {isOnline ? <Wifi className="w-4 h-4 text-primary" /> : <WifiOff className="w-4 h-4 text-cta" />}
            Offline mode
          </h2>
          <div
            className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs ${
              isOnline
                ? "bg-primary/5 border-primary/20 text-foreground"
                : "bg-cta/10 border-cta/30 text-cta"
            }`}
            role="status"
            aria-live="polite"
          >
            <span
              className={`inline-block w-2 h-2 rounded-full ${isOnline ? "bg-primary" : "bg-cta animate-pulse"}`}
            />
            <span className="flex-1 font-medium">
              {isOnline ? "Online — fresh data" : "Offline — viewing cached care data"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Care instructions, plant info, and time-lapse images are cached so they remain available without a connection.
          </p>
          <Button
            onClick={clearCareDataCache}
            disabled={careCacheBusy}
            variant="outline"
            className="w-full rounded-xl h-10 gap-2"
          >
            {careCacheBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Clear cached care data
          </Button>
          <p className="text-[10px] text-muted-foreground flex items-start gap-1">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-cta" />
            Removes saved care instructions, plant data, and time-lapse images from this device. Next visit re-downloads them.
          </p>
        </div>




        {/* Identification */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="font-serif text-lg flex items-center gap-2">
            <Sprout className="w-4 h-4 text-primary" /> Identification
          </h2>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <Label className="text-sm">AI cross-validation</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When Plant.id is uncertain, ask Gemini to pick the best match. Improves accuracy for ambiguous photos but adds AI cost.
              </p>
            </div>
            <button
              onClick={() => toggleAiValidation(!aiValidation)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${aiValidation ? "bg-primary" : "bg-muted"}`}
              aria-pressed={aiValidation}
            >
              <span className={`absolute top-0.5 ${aiValidation ? "left-5" : "left-0.5"} w-5 h-5 rounded-full bg-background transition-all`} />
            </button>
          </div>
          <Button onClick={clearIdentifyCache} variant="outline" className="w-full rounded-xl h-10">
            Clear identification cache
          </Button>
          <Button onClick={clearAppCache} variant="outline" className="w-full rounded-xl h-10">
            Clear app cache & reload
          </Button>
          <p className="text-xs text-muted-foreground">
            Use after publishing a new version to fetch the latest update immediately.
          </p>
        </div>

        {/* Profile */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="font-serif text-lg flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> {t("profile")}
          </h2>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">{t("email")}</Label>
            <Input value={email} disabled className="rounded-xl h-10 bg-muted" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">{t("displayName")}</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t("yourName")} className="rounded-xl h-10" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5">
              <Leaf className="w-3.5 h-3.5 text-primary" /> {t("gardenName")}
            </Label>
            <Input value={gardenName} onChange={(e) => setGardenName(e.target.value)} placeholder="My Garden" className="rounded-xl h-10" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5">
              <Sprout className="w-3.5 h-3.5 text-primary" /> {t("gardenBio")}
            </Label>
            <Textarea
              value={gardenBio}
              onChange={(e) => setGardenBio(e.target.value)}
              placeholder={t("gardenBioPlaceholder")}
              rows={3}
              maxLength={300}
              className="rounded-xl resize-none"
            />
            <p className="text-[10px] text-muted-foreground mt-1">{gardenBio.length}/300</p>
          </div>
          <Button onClick={handleSaveProfile} disabled={saving} className="w-full rounded-xl h-10">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("saveChanges")}
          </Button>
        </div>

        {/* Password */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="font-serif text-lg flex items-center gap-2">
            <Lock className="w-4 h-4 text-bloom" /> {t("changePassword")}
          </h2>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t("newPassword")} className="rounded-xl h-10" />
          <Button onClick={handleChangePassword} disabled={saving || newPassword.length < 6} variant="outline" className="w-full rounded-xl h-10">
            {t("updatePassword")}
          </Button>
        </div>

        {/* Sign Out */}
        <Button onClick={handleSignOut} variant="outline" className="w-full rounded-xl h-10 gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
          <LogOut className="w-4 h-4" /> {t("signOut")}
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}
