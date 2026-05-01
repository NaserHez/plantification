import { useState } from "react";
import { Camera, Leaf, Home, Menu, Stethoscope, Bot, CloudSun, Users, Calendar, Bell, Settings, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  // Primary 4 tabs in the bar
  const tabs = [
    { path: "/", icon: Home, label: t("home") },
    { path: "/identify", icon: Camera, label: t("identify") },
    { path: "/garden", icon: Leaf, label: t("garden") },
    { path: "/community", icon: Users, label: t("community") },
  ];

  // Items moved into the menu
  const menuItems = [
    { path: "/diagnose", icon: Stethoscope, label: t("health") },
    { path: "/chat", icon: Bot, label: t("aiChat") },
    { path: "/weather", icon: CloudSun, label: t("weather") },
    { path: "/planting-calendar", icon: Calendar, label: t("plantingCalendar") || "Planting Calendar" },
    { path: "/notifications", icon: Bell, label: t("notifications") },
    { path: "/settings", icon: Settings, label: t("settings") },
  ];

  const go = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex justify-around items-center h-14 max-w-md mx-auto">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-all",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", active && "animate-grow-in")} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-all",
                menuItems.some((m) => m.path === location.pathname)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={t("more") || "More"}
            >
              <Menu className="w-5 h-5" strokeWidth={1.8} />
              <span className="text-[10px] font-medium">{t("more") || "More"}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl pb-8">
            <SheetHeader className="text-left mb-2">
              <SheetTitle className="font-serif text-lg">{t("more") || "More"}</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-3 pt-2">
              {menuItems.map(({ path, icon: Icon, label }) => {
                const active = location.pathname === path;
                return (
                  <button
                    key={path}
                    onClick={() => go(path)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/30"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium text-center leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
