import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Home, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import { useLanguage } from "@/i18n/LanguageContext";

const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const plantingData: Record<number, { plants: string[]; tips: string }> = {
  0: { plants: ["Onions", "Garlic", "Lettuce", "Spinach", "Peas"], tips: "Start seeds indoors. Plan your garden layout." },
  1: { plants: ["Tomatoes (indoors)", "Peppers (indoors)", "Broccoli", "Cabbage", "Kale"], tips: "Begin indoor seed starting. Prepare soil outdoors." },
  2: { plants: ["Carrots", "Radishes", "Beets", "Potatoes", "Herbs"], tips: "Direct sow cool-season crops. Harden off seedlings." },
  3: { plants: ["Tomatoes", "Peppers", "Squash", "Beans", "Cucumbers"], tips: "Transplant warm-season crops after last frost." },
  4: { plants: ["Melons", "Corn", "Sunflowers", "Basil", "Eggplant"], tips: "All warm-season crops can go outdoors now." },
  5: { plants: ["Sweet Potatoes", "Okra", "Southern Peas", "Herbs", "Flowers"], tips: "Succession plant for continuous harvests." },
  6: { plants: ["Fall Broccoli", "Brussels Sprouts", "Kale", "Carrots", "Turnips"], tips: "Start fall garden planning and planting." },
  7: { plants: ["Lettuce", "Spinach", "Radishes", "Garlic", "Peas"], tips: "Plant cool-season crops for fall harvest." },
  8: { plants: ["Garlic", "Onions", "Cover Crops", "Spinach", "Lettuce"], tips: "Plant garlic and cover crops. Harvest remaining summer crops." },
  9: { plants: ["Garlic", "Cover Crops", "Tulip Bulbs", "Rye Grass"], tips: "Plant spring-blooming bulbs. Clean up garden beds." },
  10: { plants: ["Cover Crops", "Indoor Herbs", "Microgreens", "Sprouts"], tips: "Move gardening indoors. Plan next year's garden." },
  11: { plants: ["Indoor Herbs", "Microgreens", "Sprouts", "Seed Planning"], tips: "Order seeds for next year. Maintain indoor plants." },
};

const plantingDataAr: Record<number, { plants: string[]; tips: string }> = {
  0: { plants: ["البصل", "الثوم", "الخس", "السبانخ", "البازلاء"], tips: "ابدأ البذور في الداخل. خطط لتصميم حديقتك." },
  1: { plants: ["الطماطم (داخلي)", "الفلفل (داخلي)", "البروكلي", "الملفوف", "الكرنب"], tips: "ابدأ بذر البذور في الداخل. جهّز التربة بالخارج." },
  2: { plants: ["الجزر", "الفجل", "الشمندر", "البطاطس", "الأعشاب"], tips: "ازرع محاصيل الموسم البارد مباشرة." },
  3: { plants: ["الطماطم", "الفلفل", "القرع", "الفاصوليا", "الخيار"], tips: "انقل محاصيل الموسم الدافئ بعد آخر صقيع." },
  4: { plants: ["البطيخ", "الذرة", "دوار الشمس", "الريحان", "الباذنجان"], tips: "جميع محاصيل الموسم الدافئ يمكن زراعتها بالخارج الآن." },
  5: { plants: ["البطاطا الحلوة", "البامية", "اللوبيا", "الأعشاب", "الزهور"], tips: "ازرع بالتتابع لحصاد مستمر." },
  6: { plants: ["بروكلي الخريف", "كرنب بروكسل", "الكرنب", "الجزر", "اللفت"], tips: "ابدأ بالتخطيط والزراعة لحديقة الخريف." },
  7: { plants: ["الخس", "السبانخ", "الفجل", "الثوم", "البازلاء"], tips: "ازرع محاصيل الموسم البارد لحصاد الخريف." },
  8: { plants: ["الثوم", "البصل", "محاصيل التغطية", "السبانخ", "الخس"], tips: "ازرع الثوم ومحاصيل التغطية." },
  9: { plants: ["الثوم", "محاصيل التغطية", "أبصال التوليب", "عشب الراي"], tips: "ازرع أبصال الربيع. نظّف أحواض الحديقة." },
  10: { plants: ["محاصيل التغطية", "أعشاب داخلية", "ميكروغرين", "براعم"], tips: "انقل البستنة للداخل. خطط لحديقة العام القادم." },
  11: { plants: ["أعشاب داخلية", "ميكروغرين", "براعم", "تخطيط البذور"], tips: "اطلب بذور العام القادم. اعتنِ بالنباتات الداخلية." },
};

const plantingDataPt: Record<number, { plants: string[]; tips: string }> = {
  0: { plants: ["Cebolas", "Alho", "Alface", "Espinafre", "Ervilhas"], tips: "Comece sementes no interior. Planeie o jardim." },
  1: { plants: ["Tomates (interior)", "Pimentos (interior)", "Brócolos", "Couve", "Couve-galega"], tips: "Comece a semear no interior. Prepare o solo." },
  2: { plants: ["Cenouras", "Rabanetes", "Beterrabas", "Batatas", "Ervas"], tips: "Semeie culturas de estação fria diretamente." },
  3: { plants: ["Tomates", "Pimentos", "Abóboras", "Feijões", "Pepinos"], tips: "Transplante culturas de estação quente após última geada." },
  4: { plants: ["Melões", "Milho", "Girassóis", "Manjericão", "Beringela"], tips: "Todas as culturas de estação quente podem ir para o exterior." },
  5: { plants: ["Batata-doce", "Quiabo", "Feijão-frade", "Ervas", "Flores"], tips: "Faça plantações sucessivas para colheitas contínuas." },
  6: { plants: ["Brócolos de outono", "Couves-de-bruxelas", "Couve", "Cenouras", "Nabos"], tips: "Comece a planear o jardim de outono." },
  7: { plants: ["Alface", "Espinafre", "Rabanetes", "Alho", "Ervilhas"], tips: "Plante culturas frias para colheita de outono." },
  8: { plants: ["Alho", "Cebolas", "Culturas de cobertura", "Espinafre", "Alface"], tips: "Plante alho e culturas de cobertura." },
  9: { plants: ["Alho", "Culturas de cobertura", "Bolbos de tulipas", "Azevém"], tips: "Plante bolbos de primavera. Limpe os canteiros." },
  10: { plants: ["Culturas de cobertura", "Ervas interiores", "Microvegetais", "Rebentos"], tips: "Mude a jardinagem para interior. Planeie o próximo ano." },
  11: { plants: ["Ervas interiores", "Microvegetais", "Rebentos", "Planeamento de sementes"], tips: "Encomende sementes para o próximo ano." },
};

export default function PlantingCalendarPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const months = language === "ar" ? MONTHS_AR : language === "pt" ? MONTHS_PT : MONTHS_EN;
  const data = language === "ar" ? plantingDataAr : language === "pt" ? plantingDataPt : plantingData;
  const monthData = data[selectedMonth];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-xl hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-serif">{t("plantingCalendar")}</h1>
          <p className="text-sm text-muted-foreground">{t("plantingCalendarDesc")}</p>
        </div>
      </div>

      <div className="px-4 mt-2">
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {months.map((m, i) => (
            <button
              key={i}
              onClick={() => setSelectedMonth(i)}
              className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                selectedMonth === i
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        key={selectedMonth}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 mt-4 max-w-md mx-auto"
      >
        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h2 className="font-serif text-lg">{months[selectedMonth]}</h2>
          </div>

          <div className="mb-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              {t("bestToPlant")}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {monthData.plants.map((p) => (
                <span key={p} className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent text-accent-foreground">
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-muted/50 border border-border">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              {t("monthlyTip")}
            </h3>
            <p className="text-sm text-foreground">{monthData.tips}</p>
          </div>
        </div>
      </motion.div>

      <BottomNav />
    </div>
  );
}
