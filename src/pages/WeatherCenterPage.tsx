import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Cloud, Sun, CloudRain, Snowflake, Wind, Droplets, Thermometer, MapPin, Bot, Eye, Gauge } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { useLanguage } from "@/i18n/LanguageContext";

interface WeatherData {
  temperature: number;
  feelsLike: number;
  weatherCode: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  isDay: boolean;
  uvIndex: number;
  pressure: number;
  visibility: number;
  hourly: { time: string[]; temperature: number[]; weatherCode: number[]; humidity: number[] };
  daily: { time: string[]; tempMax: number[]; tempMin: number[]; weatherCode: number[]; precipitation: number[] };
}

const weatherLabels: Record<string, Record<number, string>> = {
  en: { 0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Foggy", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers", 95: "Thunderstorm" },
  ar: { 0: "صافي", 1: "صافي غالباً", 2: "غائم جزئياً", 3: "غائم", 45: "ضبابي", 51: "رذاذ خفيف", 53: "رذاذ", 55: "رذاذ كثيف", 61: "مطر خفيف", 63: "مطر", 65: "مطر غزير", 71: "ثلج خفيف", 73: "ثلج", 75: "ثلج كثيف", 80: "زخات مطر", 95: "عاصفة رعدية" },
  pt: { 0: "Céu limpo", 1: "Quase limpo", 2: "Parcialmente nublado", 3: "Nublado", 45: "Nevoeiro", 51: "Chuvisco leve", 53: "Chuvisco", 55: "Chuvisco forte", 61: "Chuva leve", 63: "Chuva", 65: "Chuva forte", 71: "Neve leve", 73: "Neve", 75: "Neve forte", 80: "Aguaceiros", 95: "Trovoada" },
};

function getWeatherIcon(code: number, size = 5) {
  const cls = `w-${size} h-${size}`;
  if (code <= 1) return <Sun className={`${cls} text-sun`} />;
  if (code <= 3) return <Cloud className={`${cls} text-muted-foreground`} />;
  if (code >= 71) return <Snowflake className={`${cls} text-water`} />;
  if (code >= 51) return <CloudRain className={`${cls} text-water`} />;
  return <Cloud className={`${cls} text-muted-foreground`} />;
}

function getWeatherLabel(code: number, lang: string): string {
  const labels = weatherLabels[lang] || weatherLabels.en;
  if (labels[code]) return labels[code];
  const codes = Object.keys(labels).map(Number).sort((a, b) => Math.abs(a - code) - Math.abs(b - code));
  return labels[codes[0]] || "";
}

const plantingAdvice: Record<string, Record<string, { tip: string; actions: string[] }>> = {
  en: {
    hot: { tip: "Extreme heat — protect plants from scorching.", actions: ["Water deeply at dawn or dusk", "Add mulch around base", "Move pots to shade", "Mist leaves of tropical plants"] },
    warm: { tip: "Warm conditions — great for most plants.", actions: ["Keep regular watering schedule", "Good time to fertilize", "Monitor for pests", "Transplant in evening"] },
    mild: { tip: "Ideal growing conditions.", actions: ["Perfect for transplanting", "Sow cool-season seeds", "Divide perennials", "Start composting"] },
    cool: { tip: "Cool weather — root vegetables thrive.", actions: ["Plant leafy greens", "Protect tender plants", "Apply mulch for insulation", "Reduce watering frequency"] },
    cold: { tip: "Cold conditions — focus on protection.", actions: ["Bring potted plants inside", "Cover garden beds", "Plan spring plantings", "Start seeds indoors"] },
    rainy: { tip: "Rainy day — skip watering.", actions: ["Check drainage", "Watch for fungal diseases", "Avoid transplanting", "Harvest ripe produce"] },
  },
  ar: {
    hot: { tip: "حرارة شديدة — احمِ النباتات من الاحتراق.", actions: ["اسقِ بعمق عند الفجر أو الغسق", "أضف نشارة حول القاعدة", "انقل الأصص للظل", "رش أوراق النباتات الاستوائية"] },
    warm: { tip: "ظروف دافئة — رائعة لمعظم النباتات.", actions: ["حافظ على جدول الري", "وقت جيد للتسميد", "راقب الآفات", "انقل في المساء"] },
    mild: { tip: "ظروف نمو مثالية.", actions: ["مثالي للنقل", "ازرع بذور الموسم البارد", "قسّم النباتات المعمرة", "ابدأ التسميد"] },
    cool: { tip: "طقس بارد — الخضروات الجذرية تزدهر.", actions: ["ازرع الورقيات", "احمِ النباتات الحساسة", "أضف نشارة للعزل", "قلل تكرار الري"] },
    cold: { tip: "ظروف باردة — ركّز على الحماية.", actions: ["أدخل النباتات المحفوظة", "غطِّ أحواض الحديقة", "خطّط لزراعة الربيع", "ابدأ البذور داخلياً"] },
    rainy: { tip: "يوم ممطر — لا تسقِ.", actions: ["تحقق من التصريف", "راقب الأمراض الفطرية", "تجنب النقل", "احصد المنتجات الناضجة"] },
  },
  pt: {
    hot: { tip: "Calor extremo — protege as plantas.", actions: ["Rega profundamente ao amanhecer", "Adiciona mulch", "Move vasos para sombra", "Nebuliza folhas tropicais"] },
    warm: { tip: "Condições quentes — ótimo para a maioria.", actions: ["Mantém rega regular", "Bom momento para fertilizar", "Monitoriza pragas", "Transplanta à noite"] },
    mild: { tip: "Condições ideais de crescimento.", actions: ["Perfeito para transplantar", "Semeia culturas frias", "Divide perenes", "Começa compostagem"] },
    cool: { tip: "Tempo fresco — raízes prosperam.", actions: ["Planta folhosas", "Protege plantas sensíveis", "Aplica mulch", "Reduz frequência de rega"] },
    cold: { tip: "Frio — foca na proteção.", actions: ["Leva vasos para dentro", "Cobre canteiros", "Planeia primavera", "Começa sementes no interior"] },
    rainy: { tip: "Dia chuvoso — não regues.", actions: ["Verifica drenagem", "Atenção a fungos", "Evita transplantar", "Colhe produtos maduros"] },
  },
};

function getConditionKey(temp: number, weatherCode: number): string {
  if (weatherCode >= 51 && weatherCode <= 67) return "rainy";
  if (weatherCode >= 80 && weatherCode <= 82) return "rainy";
  if (temp >= 35) return "hot";
  if (temp >= 25) return "warm";
  if (temp >= 15) return "mild";
  if (temp >= 5) return "cool";
  return "cold";
}

const DAY_NAMES: Record<string, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ar: ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"],
  pt: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
};

export default function WeatherCenterPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        let lat = 40.4168, lon = -3.7038;
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
        } catch {}

        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day,surface_pressure,uv_index&hourly=temperature_2m,weather_code,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum&timezone=auto&forecast_days=7`
        );
        const data = await res.json();

        setWeather({
          temperature: Math.round(data.current.temperature_2m),
          feelsLike: Math.round(data.current.apparent_temperature),
          weatherCode: data.current.weather_code,
          humidity: data.current.relative_humidity_2m,
          windSpeed: Math.round(data.current.wind_speed_10m),
          windDirection: data.current.wind_direction_10m || 0,
          isDay: data.current.is_day === 1,
          uvIndex: Math.round(data.current.uv_index || 0),
          pressure: Math.round(data.current.surface_pressure || 1013),
          visibility: 10,
          hourly: {
            time: data.hourly.time.slice(0, 24),
            temperature: data.hourly.temperature_2m.slice(0, 24),
            weatherCode: data.hourly.weather_code.slice(0, 24),
            humidity: data.hourly.relative_humidity_2m.slice(0, 24),
          },
          daily: {
            time: data.daily.time,
            tempMax: data.daily.temperature_2m_max,
            tempMin: data.daily.temperature_2m_min,
            weatherCode: data.daily.weather_code,
            precipitation: data.daily.precipitation_sum,
          },
        });
        setCity(`${lat.toFixed(1)}°, ${lon.toFixed(1)}°`);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchWeather();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  if (!weather) return null;

  const condKey = getConditionKey(weather.temperature, weather.weatherCode);
  const advice = (plantingAdvice[language] || plantingAdvice.en)[condKey];
  const label = getWeatherLabel(weather.weatherCode, language);
  const dayNames = DAY_NAMES[language] || DAY_NAMES.en;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-xl hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-serif">{t("weatherCenter")}</h1>
      </div>

      <div className="px-4 max-w-md mx-auto space-y-4 mt-2">
        {/* Current conditions hero */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {getWeatherIcon(weather.weatherCode, 8)}
                <span className="text-4xl font-bold">{weather.temperature}°C</span>
              </div>
              <p className="text-sm text-muted-foreground">{label}</p>
              {city && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <MapPin className="w-3 h-3" />
                  {city}
                </div>
              )}
            </div>
            <div className="text-right space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center justify-end gap-1">
                <Thermometer className="w-3.5 h-3.5" />
                {t("feelsLike")} {weather.feelsLike}°C
              </div>
              <div className="flex items-center justify-end gap-1">
                <Droplets className="w-3.5 h-3.5" />
                {weather.humidity}%
              </div>
              <div className="flex items-center justify-end gap-1">
                <Wind className="w-3.5 h-3.5" />
                {weather.windSpeed} km/h
              </div>
              <div className="flex items-center justify-end gap-1">
                <Sun className="w-3.5 h-3.5" />
                UV {weather.uvIndex}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Planting advice */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-accent/50 rounded-2xl p-4 border border-border">
          <p className="text-sm font-medium mb-2">🌱 {t("gardeningTip")}</p>
          <p className="text-xs text-muted-foreground mb-3">{advice.tip}</p>
          <div className="space-y-1.5">
            {advice.actions.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {a}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Hourly forecast */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="font-serif text-sm mb-3">{t("hourlyForecast")}</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {weather.hourly.time.filter((_, i) => i % 3 === 0).map((time, i) => {
              const idx = i * 3;
              const hour = new Date(time).getHours();
              return (
                <div key={time} className="flex flex-col items-center gap-1 min-w-[48px]">
                  <span className="text-[10px] text-muted-foreground">{hour}:00</span>
                  {getWeatherIcon(weather.hourly.weatherCode[idx], 4)}
                  <span className="text-xs font-medium">{Math.round(weather.hourly.temperature[idx])}°</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* 7-day forecast */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="font-serif text-sm mb-3">{t("weeklyForecast")}</h3>
          <div className="space-y-2.5">
            {weather.daily.time.map((date, i) => {
              const d = new Date(date);
              const dayName = dayNames[d.getDay()];
              return (
                <div key={date} className="flex items-center justify-between text-xs">
                  <span className="w-10 text-muted-foreground">{dayName}</span>
                  <div className="flex-shrink-0">{getWeatherIcon(weather.daily.weatherCode[i], 4)}</div>
                  <div className="flex items-center gap-2 ml-auto">
                    {weather.daily.precipitation[i] > 0 && (
                      <span className="text-water text-[10px]">{weather.daily.precipitation[i].toFixed(1)}mm</span>
                    )}
                    <span className="font-medium">{Math.round(weather.daily.tempMax[i])}°</span>
                    <span className="text-muted-foreground">{Math.round(weather.daily.tempMin[i])}°</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Ask AI about weather */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Button
            onClick={() => navigate(`/chat?plant=weather`)}
            variant="outline"
            className="w-full rounded-xl h-11 gap-2"
          >
            <Bot className="w-4 h-4" />
            {t("askWeatherAi")}
          </Button>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}
