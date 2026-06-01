import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, Moon, Sun, Monitor, User, Lock, Leaf, Loader2, Globe, Bell, BellOff, Languages, Volume2, Clock, Sprout } from "lucide-react";
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
import { ensurePushSubscription, syncPushSettings, isPushSupported } from "@/lib/push";

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
  const [aiValidation, setAiValidation] = useState(() => localStorage.getItem("identify_ai_validation") !== "false");

  const toggleAiValidation = (val: boolean) => {
    setAiValidation(val);
    localStorage.setItem("identify_ai_validation", val ? "true" : "false");
    toast.success(t("settingsSaved"));
  };

  const clearIdentifyCache = () => {
    localStorage.removeItem("identify_cache_v1");
    toast.success("Identification cache cleared");
  };

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, garden_bio")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.display_name) setDisplayName(profile.display_name);
      if (profile?.garden_bio) setGardenBio(profile.garden_bio);

      const saved = localStorage.getItem("garden_name");
      if (saved) setGardenName(saved);
      const savedLang = localStorage.getItem("plant_language");
      if (savedLang) setCareLang(savedLang);

      if ("Notification" in window) {
        setNotifPermission(Notification.permission);
      }
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
    await supabase.auth.signOut();
    navigate("/");
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
            </>
          )}
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
