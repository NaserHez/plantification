import { Camera, Leaf, Home, Stethoscope, Bot, CloudSun } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const tabs = [
    { path: "/", icon: Home, label: t("home") },
    { path: "/identify", icon: Camera, label: t("identify") },
    { path: "/diagnose", icon: Stethoscope, label: t("health") },
    { path: "/chat", icon: Bot, label: t("aiChat") },
    { path: "/weather", icon: CloudSun, label: t("weather") },
    { path: "/garden", icon: Leaf, label: t("garden") },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
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
      </div>
    </nav>
  );
}
