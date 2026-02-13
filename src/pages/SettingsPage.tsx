import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, Moon, Sun, Monitor, User, Lock, Leaf, Loader2, Globe, Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import BottomNav from "@/components/BottomNav";

const LANGUAGES = [
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "ar", label: "العربية", flag: "🇸🇦" },
  { value: "pt", label: "Português", flag: "🇵🇹" },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [gardenName, setGardenName] = useState("My Garden");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState("en");
  const [notifPermission, setNotifPermission] = useState<string>("default");

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
      if (savedLang) setLanguage(savedLang);

      if ("Notification" in window) {
        setNotifPermission(Notification.permission);
      }
      setLoading(false);
    };
    load();
  }, []);

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
      localStorage.setItem("plant_language", language);

      toast.success("Settings saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated!");
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
        toast.success("Notifications enabled!");
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-serif">Settings</h1>
      </div>

      <div className="px-4 max-w-md mx-auto space-y-6 mt-2">
        {/* Theme */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="font-serif text-lg flex items-center gap-2">
            <Sun className="w-4 h-4 text-sun" /> Appearance
          </h2>
          <Select value={theme || "system"} onValueChange={setTheme}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light"><span className="flex items-center gap-2"><Sun className="w-4 h-4" /> Light</span></SelectItem>
              <SelectItem value="dark"><span className="flex items-center gap-2"><Moon className="w-4 h-4" /> Dark</span></SelectItem>
              <SelectItem value="system"><span className="flex items-center gap-2"><Monitor className="w-4 h-4" /> System</span></SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Language */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="font-serif text-lg flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" /> Care Tips Language
          </h2>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  <span className="flex items-center gap-2">{lang.flag} {lang.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Care tips for newly identified plants will be generated in this language. You can also change the language per plant.</p>
        </div>

        {/* Notifications */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="font-serif text-lg flex items-center gap-2">
            {notifPermission === "granted" ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
            Watering Reminders
          </h2>
          <p className="text-xs text-muted-foreground">
            {notifPermission === "granted"
              ? "Notifications are enabled. You'll be reminded when plants need watering."
              : "Enable notifications to get watering reminders when you open the app."}
          </p>
          {notifPermission !== "granted" && (
            <Button onClick={handleRequestNotifications} variant="outline" className="w-full rounded-xl h-10 gap-2">
              <Bell className="w-4 h-4" /> Enable Notifications
            </Button>
          )}
        </div>

        {/* Profile */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="font-serif text-lg flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> Profile
          </h2>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Email</Label>
            <Input value={email} disabled className="rounded-xl h-10 bg-muted" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Display Name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="rounded-xl h-10" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5">
              <Leaf className="w-3.5 h-3.5 text-primary" /> Garden Name
            </Label>
            <Input value={gardenName} onChange={(e) => setGardenName(e.target.value)} placeholder="My Garden" className="rounded-xl h-10" />
          </div>
          <Button onClick={handleSaveProfile} disabled={saving} className="w-full rounded-xl h-10">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
          </Button>
        </div>

        {/* Password */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
          <h2 className="font-serif text-lg flex items-center gap-2">
            <Lock className="w-4 h-4 text-bloom" /> Change Password
          </h2>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (min 6 chars)" className="rounded-xl h-10" />
          <Button onClick={handleChangePassword} disabled={saving || newPassword.length < 6} variant="outline" className="w-full rounded-xl h-10">
            Update Password
          </Button>
        </div>

        {/* Sign Out */}
        <Button onClick={handleSignOut} variant="outline" className="w-full rounded-xl h-10 gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
          <LogOut className="w-4 h-4" /> Sign Out
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}
