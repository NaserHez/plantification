import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Leaf, Sparkles, Stethoscope, Bot, Settings, Bell, CalendarDays, ArrowRight, Sprout, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import { useLanguage } from "@/i18n/LanguageContext";
import WeatherWidget from "@/components/WeatherWidget";
import { supabase } from "@/integrations/supabase/client";
import { getOverduePlants } from "@/hooks/use-watering-reminders";

const seasonalData: Record<string, Record<number, { plants: string[]; tip: string }>> = {
  en: {
    0: { plants: ["Onions", "Garlic", "Lettuce", "Spinach", "Peas"], tip: "Start seeds indoors & plan your garden layout." },
    1: { plants: ["Tomatoes (indoors)", "Broccoli", "Cabbage", "Kale"], tip: "Begin indoor seed starting." },
    2: { plants: ["Carrots", "Radishes", "Beets", "Potatoes", "Herbs"], tip: "Direct sow cool-season crops." },
    3: { plants: ["Tomatoes", "Peppers", "Squash", "Beans", "Cucumbers"], tip: "Transplant after last frost." },
    4: { plants: ["Melons", "Corn", "Sunflowers", "Basil", "Eggplant"], tip: "All warm-season crops can go outdoors." },
    5: { plants: ["Sweet Potatoes", "Okra", "Herbs", "Flowers"], tip: "Succession plant for continuous harvests." },
    6: { plants: ["Fall Broccoli", "Brussels Sprouts", "Kale", "Carrots"], tip: "Start fall garden planning." },
    7: { plants: ["Lettuce", "Spinach", "Radishes", "Garlic", "Peas"], tip: "Plant cool-season crops for fall." },
    8: { plants: ["Garlic", "Onions", "Cover Crops", "Spinach"], tip: "Plant garlic & cover crops." },
    9: { plants: ["Garlic", "Tulip Bulbs", "Rye Grass"], tip: "Plant spring-blooming bulbs." },
    10: { plants: ["Indoor Herbs", "Microgreens", "Sprouts"], tip: "Move gardening indoors." },
    11: { plants: ["Indoor Herbs", "Microgreens", "Seed Planning"], tip: "Order seeds for next year." },
  },
  ar: {
    0: { plants: ["البصل", "الثوم", "الخس", "السبانخ", "البازلاء"], tip: "ابدأ البذور في الداخل." },
    1: { plants: ["الطماطم (داخلي)", "البروكلي", "الملفوف", "الكرنب"], tip: "ابدأ بذر البذور في الداخل." },
    2: { plants: ["الجزر", "الفجل", "الشمندر", "البطاطس"], tip: "ازرع محاصيل الموسم البارد." },
    3: { plants: ["الطماطم", "الفلفل", "القرع", "الفاصوليا", "الخيار"], tip: "انقل المحاصيل بعد آخر صقيع." },
    4: { plants: ["البطيخ", "الذرة", "دوار الشمس", "الريحان"], tip: "جميع المحاصيل الدافئة للخارج." },
    5: { plants: ["البطاطا الحلوة", "البامية", "الأعشاب", "الزهور"], tip: "ازرع بالتتابع لحصاد مستمر." },
    6: { plants: ["بروكلي الخريف", "كرنب بروكسل", "الكرنب"], tip: "خطط لحديقة الخريف." },
    7: { plants: ["الخس", "السبانخ", "الفجل", "الثوم"], tip: "ازرع محاصيل باردة للخريف." },
    8: { plants: ["الثوم", "البصل", "محاصيل التغطية"], tip: "ازرع الثوم ومحاصيل التغطية." },
    9: { plants: ["الثوم", "أبصال التوليب"], tip: "ازرع أبصال الربيع." },
    10: { plants: ["أعشاب داخلية", "ميكروغرين", "براعم"], tip: "انقل البستنة للداخل." },
    11: { plants: ["أعشاب داخلية", "ميكروغرين", "تخطيط البذور"], tip: "اطلب بذور العام القادم." },
  },
  pt: {
    0: { plants: ["Cebolas", "Alho", "Alface", "Espinafre", "Ervilhas"], tip: "Comece sementes no interior." },
    1: { plants: ["Tomates (interior)", "Brócolos", "Couve", "Couve-galega"], tip: "Comece a semear no interior." },
    2: { plants: ["Cenouras", "Rabanetes", "Beterrabas", "Batatas"], tip: "Semeie culturas frias." },
    3: { plants: ["Tomates", "Pimentos", "Abóboras", "Feijões", "Pepinos"], tip: "Transplante após última geada." },
    4: { plants: ["Melões", "Milho", "Girassóis", "Manjericão"], tip: "Culturas quentes para o exterior." },
    5: { plants: ["Batata-doce", "Quiabo", "Ervas", "Flores"], tip: "Plantações sucessivas." },
    6: { plants: ["Brócolos de outono", "Couves-de-bruxelas", "Couve"], tip: "Planeie o jardim de outono." },
    7: { plants: ["Alface", "Espinafre", "Rabanetes", "Alho"], tip: "Plante culturas frias para outono." },
    8: { plants: ["Alho", "Cebolas", "Culturas de cobertura"], tip: "Plante alho e coberturas." },
    9: { plants: ["Alho", "Bolbos de tulipas", "Azevém"], tip: "Plante bolbos de primavera." },
    10: { plants: ["Ervas interiores", "Microvegetais", "Rebentos"], tip: "Jardinagem interior." },
    11: { plants: ["Ervas interiores", "Microvegetais", "Planeamento"], tip: "Encomende sementes." },
  },
};

const MONTH_NAMES: Record<string, string[]> = {
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
  ar: ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"],
  pt: ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"],
};

export default function Index() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    const fetchPlants = async () => {
      const { data } = await supabase
        .from("plants")
        .select("id, name, nickname, watering_frequency, last_watered")
        .order("created_at", { ascending: false });
      setOverdueCount(getOverduePlants(data || []).length);
    };
    fetchPlants();
  }, []);

  const currentMonth = new Date().getMonth();
  const monthName = MONTH_NAMES[language]?.[currentMonth] || MONTH_NAMES.en[currentMonth];
  const monthData = seasonalData[language]?.[currentMonth] || seasonalData.en[currentMonth];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/30 to-leaf-light/40 px-6 pt-12 pb-10">
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <button
            onClick={() => navigate("/notifications")}
            className="relative p-2 rounded-full bg-background/70 backdrop-blur-sm hover:bg-background/90 transition-colors"
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            {overdueCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {overdueCount > 9 ? "9+" : overdueCount}
              </span>
            )}
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

      {/* Weather Widget */}
      <div className="px-6 max-w-md mx-auto mt-4">
        <WeatherWidget />
      </div>

      {/* Seasonal Widget */}
      <div className="px-6 max-w-md mx-auto mt-3">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          onClick={() => navigate("/planting-calendar")}
          className="bg-card rounded-2xl p-4 border border-border shadow-sm cursor-pointer hover:border-primary/30 transition-colors"
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Sprout className="w-5 h-5 text-primary" />
              <h3 className="font-serif text-sm">{t("plantThisMonth")}</h3>
            </div>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{monthName}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {monthData.plants.slice(0, 5).map((p) => (
              <span key={p} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent text-accent-foreground">
                {p}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{monthData.tip}</p>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 ms-2" />
          </div>
        </motion.div>
      </div>

      {/* Feature cards */}
      <div className="px-6 max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 gap-3 mt-4"
        >
          {[
            { icon: Camera, title: t("instantId"), desc: t("instantIdDesc"), color: "text-primary", path: "/identify" },
            { icon: Sparkles, title: t("careTips"), desc: t("careTipsDesc"), color: "text-sun", path: "/garden" },
            { icon: Stethoscope, title: t("diagnose"), desc: t("diagnoseDesc"), color: "text-bloom", path: "/diagnose" },
            { icon: Bot, title: t("aiChat"), desc: t("aiChatDesc"), color: "text-water", path: "/chat" },
            { icon: CalendarDays, title: t("plantingCalendar"), desc: t("plantingCalendarDesc"), color: "text-primary", path: "/planting-calendar" },
            { icon: Thermometer, title: t("weatherCenter"), desc: t("askWeatherAi"), color: "text-sun", path: "/weather" },
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
