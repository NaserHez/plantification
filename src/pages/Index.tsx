import { useNavigate } from "react-router-dom";
import { Camera, Leaf, Sparkles, Stethoscope, Bot, Settings, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import { useLanguage } from "@/i18n/LanguageContext";

export default function Index() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/30 to-leaf-light/40 px-6 pt-12 pb-10">
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <button
            onClick={() => navigate("/notifications")}
            className="p-2 rounded-full bg-background/70 backdrop-blur-sm hover:bg-background/90 transition-colors"
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
          </button>
          <button
            onClick={() => navigate("/settings")}
            className="p-2 rounded-full bg-background/70 backdrop-blur-sm hover:bg-background/90 transition-colors"
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto"
        >
          <div className="flex items-center gap-2 mb-2">
            <Leaf className="w-6 h-6 text-primary animate-leaf-sway" />
            <span className="text-sm font-medium text-primary">{t("appName")}</span>
          </div>
          <h1 className="text-4xl font-serif leading-tight mb-3">
            {t("heroTitle1")}<br />
            <span className="text-primary">{t("heroTitle2")}</span>
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            {t("heroSubtitle")}
          </p>
          <div className="flex gap-3">
            <Button onClick={() => navigate("/identify")} className="h-11 rounded-xl px-5 gap-2">
              <Camera className="w-4 h-4" />
              {t("identify")}
            </Button>
            <Button onClick={() => navigate("/garden")} variant="outline" className="h-11 rounded-xl px-5 gap-2">
              <Leaf className="w-4 h-4" />
              {t("myGarden")}
            </Button>
          </div>
        </motion.div>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/5" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-sun/10" />
      </div>

      {/* Feature cards */}
      <div className="px-6 -mt-2 max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 gap-3 mt-6"
        >
          {[
            { icon: Camera, title: t("instantId"), desc: t("instantIdDesc"), color: "text-primary", path: "/identify" },
            { icon: Sparkles, title: t("careTips"), desc: t("careTipsDesc"), color: "text-sun", path: "/garden" },
            { icon: Stethoscope, title: t("diagnose"), desc: t("diagnoseDesc"), color: "text-bloom", path: "/diagnose" },
            { icon: Bot, title: t("aiChat"), desc: t("aiChatDesc"), color: "text-water", path: "/chat" },
          ].map(({ icon: Icon, title, desc, color, path }) => (
            <button
              key={title}
              onClick={() => navigate(path)}
              className="bg-card rounded-2xl p-4 border border-border text-left hover:border-primary/30 transition-colors"
            >
              <Icon className={`w-6 h-6 ${color} mb-2`} />
              <h3 className="font-serif text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </button>
          ))}
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}
