import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, Moon, Sun, Monitor, User, Lock, Leaf, Loader2, Globe, Bell, BellOff, Languages, Volume2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import BottomNav from "@/components/BottomNav";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Language } from "@/i18n/translations";

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
  { value: "default", label: "🔔 Default", labelAr: "🔔 افتراضي", labelPt: "🔔 Predefinido" },
  { value: "gentle", label: "🌿 Gentle", labelAr: "🌿 لطيف", labelPt: "🌿 Suave" },
  { value: "silent", label: "🔇 Silent", labelAr: "🔇 صامت", labelPt: "🔇 Silencioso" },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { t, language: appLanguage, setLanguage: setAppLanguage } = useLanguage();
  const [displayName, setDisplayName] = useState("");
  const [gardenName, setGardenName] = useState("My Garden");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [email, setEmail] = useState("");
  const [careLang, setCareLang] = useState("en");
  const [notifPermission, setNotifPermission] = useState<string>("default");
  const [notifTone, setNotifTone] = useState(() => localStorage.getItem("notif_tone") || "default");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.display_name) setDisplayName(profile.display_name);

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

  const handleToneChange = (tone: string) => {
    setNotifTone(tone);
    localStorage.setItem("notif_tone", tone);
    toast.success(t("settingsSaved"));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("profiles").upsert(
        { user_id: user.id, display_name: displayName },
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
    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
      if (result === "granted") {
        toast.success(t("notifEnabled"));
      } else {
        toast.error("Notification permission denied");
      }
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
            <div className="pt-2 border-t border-border">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                <Volume2 className="w-3.5 h-3.5" /> {t("notifTone")}
              </Label>
              <div className="grid grid-cols-3 gap-2">
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
          )}
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
