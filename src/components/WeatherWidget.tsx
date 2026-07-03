import { useState, useEffect } from "react";
import { Cloud, Sun, CloudRain, Snowflake, Wind, Droplets, Thermometer, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatTemp, formatWind } from "@/lib/units";
import { useUnits } from "@/hooks/use-units";

interface WeatherData {
  temperature: number;
  weatherCode: number;
  humidity: number;
  windSpeed: number;
  isDay: boolean;
}

const weatherLabels: Record<string, Record<number, string>> = {
  en: { 0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Foggy", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers", 95: "Thunderstorm" },
  ar: { 0: "صافي", 1: "صافي غالباً", 2: "غائم جزئياً", 3: "غائم", 45: "ضبابي", 51: "رذاذ خفيف", 53: "رذاذ", 55: "رذاذ كثيف", 61: "مطر خفيف", 63: "مطر", 65: "مطر غزير", 71: "ثلج خفيف", 73: "ثلج", 75: "ثلج كثيف", 80: "زخات مطر", 95: "عاصفة رعدية" },
  pt: { 0: "Céu limpo", 1: "Quase limpo", 2: "Parcialmente nublado", 3: "Nublado", 45: "Nevoeiro", 51: "Chuvisco leve", 53: "Chuvisco", 55: "Chuvisco forte", 61: "Chuva leve", 63: "Chuva", 65: "Chuva forte", 71: "Neve leve", 73: "Neve", 75: "Neve forte", 80: "Aguaceiros", 95: "Trovoada" },
};

const plantingAdvice: Record<string, Record<string, { tip: string; warning?: string }>> = {
  en: {
    hot: { tip: "Water deeply in early morning or evening. Mulch to retain moisture.", warning: "Avoid transplanting in extreme heat." },
    warm: { tip: "Great conditions for most plants. Keep up regular watering." },
    mild: { tip: "Ideal for planting cool-season crops and transplanting seedlings." },
    cool: { tip: "Perfect for root vegetables and leafy greens. Protect tender plants from frost." },
    cold: { tip: "Focus on indoor gardening. Plan spring plantings.", warning: "Bring sensitive plants indoors." },
    rainy: { tip: "Skip watering today. Check drainage to prevent root rot." },
    dry: { tip: "Increase watering frequency. Consider drip irrigation." },
  },
  ar: {
    hot: { tip: "اسقِ بعمق في الصباح الباكر أو المساء. استخدم المهاد للحفاظ على الرطوبة.", warning: "تجنب نقل النباتات في الحر الشديد." },
    warm: { tip: "ظروف رائعة لمعظم النباتات. حافظ على الري المنتظم." },
    mild: { tip: "مثالي لزراعة محاصيل الموسم البارد ونقل الشتلات." },
    cool: { tip: "مثالي للخضروات الجذرية والورقيات. احمِ النباتات الحساسة من الصقيع." },
    cold: { tip: "ركّز على الزراعة الداخلية. خطّط لزراعة الربيع.", warning: "أدخل النباتات الحساسة." },
    rainy: { tip: "لا تسقِ اليوم. تحقق من التصريف لمنع تعفن الجذور." },
    dry: { tip: "زِد تكرار الري. فكّر في الري بالتنقيط." },
  },
  pt: {
    hot: { tip: "Rega profundamente de manhã cedo ou à noite. Usa mulch para manter a humidade.", warning: "Evita transplantar com calor extremo." },
    warm: { tip: "Ótimas condições para a maioria das plantas. Mantém a rega regular." },
    mild: { tip: "Ideal para culturas de estação fria e transplantar mudas." },
    cool: { tip: "Perfeito para raízes e folhosas. Protege plantas sensíveis da geada." },
    cold: { tip: "Foca na jardinagem interior. Planeia plantações de primavera.", warning: "Leva plantas sensíveis para dentro." },
    rainy: { tip: "Não regues hoje. Verifica a drenagem para prevenir podridão radicular." },
    dry: { tip: "Aumenta a frequência de rega. Considera rega gota a gota." },
  },
};

function getWeatherIcon(code: number, size = 5) {
  const cls = `w-${size} h-${size}`;
  if (code <= 1) return <Sun className={`${cls} text-sun`} />;
  if (code <= 3) return <Cloud className={`${cls} text-muted-foreground`} />;
  if (code >= 71) return <Snowflake className={`${cls} text-water`} />;
  if (code >= 51) return <CloudRain className={`${cls} text-water`} />;
  return <Cloud className={`${cls} text-muted-foreground`} />;
}

function getConditionKey(temp: number, weatherCode: number): string {
  if (weatherCode >= 51 && weatherCode <= 67) return "rainy";
  if (weatherCode >= 80 && weatherCode <= 82) return "rainy";
  if (temp >= 35) return "hot";
  if (temp >= 25) return "warm";
  if (temp >= 15) return "mild";
  if (temp >= 5) return "cool";
  return "cold";
}

function getWeatherLabel(code: number, lang: string): string {
  const labels = weatherLabels[lang] || weatherLabels.en;
  if (labels[code]) return labels[code];
  // Find closest
  const codes = Object.keys(labels).map(Number).sort((a, b) => Math.abs(a - code) - Math.abs(b - code));
  return labels[codes[0]] || "";
}

export default function WeatherWidget() {
  const { t, language } = useLanguage();
  const units = useUnits();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);


  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Try geolocation first
        let lat = 40.4168, lon = -3.7038; // Default: Madrid
        let cityName = "";

        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
        } catch {
          // Use default
        }

        // Fetch weather from Open-Meteo (free, no API key)
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day`
        );
        const data = await res.json();

        setWeather({
          temperature: Math.round(data.current.temperature_2m),
          weatherCode: data.current.weather_code,
          humidity: data.current.relative_humidity_2m,
          windSpeed: Math.round(data.current.wind_speed_10m),
          isDay: data.current.is_day === 1,
        });

        // Reverse geocode for city name
        try {
          const geoRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=&latitude=${lat}&longitude=${lon}&count=1`
          );
          // Use a simpler approach - just show coordinates area
          const roundedLat = lat.toFixed(1);
          const roundedLon = lon.toFixed(1);
          cityName = `${roundedLat}°, ${roundedLon}°`;
        } catch {
          cityName = `${lat.toFixed(1)}°, ${lon.toFixed(1)}°`;
        }

        setCity(cityName);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, []);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl p-4 border border-border shadow-sm animate-pulse">
        <div className="h-20" />
      </div>
    );
  }

  if (error || !weather) return null;

  const conditionKey = getConditionKey(weather.temperature, weather.weatherCode);
  const advice = (plantingAdvice[language] || plantingAdvice.en)[conditionKey];
  const weatherLabel = getWeatherLabel(weather.weatherCode, language);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-card rounded-2xl p-4 border border-border shadow-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getWeatherIcon(weather.weatherCode)}
          <div>
            <h3 className="font-serif text-sm">{t("weatherTitle")}</h3>
            {city && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <MapPin className="w-2.5 h-2.5" />
                {city}
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-semibold">{formatTemp(weather.temperature, units)}</span>
          <p className="text-[10px] text-muted-foreground">{weatherLabel}</p>
        </div>
      </div>

      <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Droplets className="w-3.5 h-3.5" />
          {weather.humidity}%
        </div>
        <div className="flex items-center gap-1">
          <Wind className="w-3.5 h-3.5" />
          {formatWind(weather.windSpeed, units)}
        </div>
      </div>

      <div className="bg-accent/50 rounded-xl p-3">
        <p className="text-xs font-medium mb-0.5">🌱 {t("gardeningTip")}</p>
        <p className="text-xs text-muted-foreground">{advice.tip}</p>
        {advice.warning && (
          <p className="text-xs text-destructive mt-1">⚠️ {advice.warning}</p>
        )}
      </div>
    </motion.div>
  );
}
