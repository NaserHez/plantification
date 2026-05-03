import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Send, Loader2, Bot, User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import ReactMarkdown from "react-markdown";
import { useLanguage } from "@/i18n/LanguageContext";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plant-chat`;

export default function PlantChatPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const plantQuery = searchParams.get("plant");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [plantContext, setPlantContext] = useState<string>("");
  const [weatherContext, setWeatherContext] = useState<string>("");
  const [autoSent, setAutoSent] = useState(false);
  const [sessionState, setSessionState] = useState<"checking" | "signed-in" | "signed-out">("checking");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track auth session for sign-in gate
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionState(data.session ? "signed-in" : "signed-out");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSessionState(session ? "signed-in" : "signed-out");
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchPlants = async () => {
      const { data } = await supabase
        .from("plants")
        .select("name, nickname, scientific_name, watering_frequency, sunlight, location, last_watered, care_tips")
        .order("created_at", { ascending: false });
      if (data && data.length > 0) {
        const summary = data.map((p) =>
          `- ${p.nickname || p.name}${p.scientific_name ? ` (${p.scientific_name})` : ""}: ${p.location || "unknown location"}, water ${p.watering_frequency || "weekly"}, sunlight ${p.sunlight || "medium"}${p.last_watered ? `, last watered ${p.last_watered}` : ""}`
        ).join("\n");
        setPlantContext(summary);
      }
    };

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
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`
        );
        const data = await res.json();
        setWeatherContext(
          `Temperature: ${data.current.temperature_2m}°C, Humidity: ${data.current.relative_humidity_2m}%, Weather code: ${data.current.weather_code}, Wind: ${data.current.wind_speed_10m} km/h`
        );
      } catch {}
    };

    fetchPlants();
    fetchWeather();
  }, []);

  useEffect(() => {
    if (plantQuery && !autoSent && plantContext !== undefined) {
      if (plantQuery === "weather") {
        setInput(t("weatherChatPrompt"));
      } else {
        setInput(`Tell me about caring for my ${plantQuery}. What should I know?`);
      }
      setAutoSent(true);
    }
  }, [plantQuery, autoSent, plantContext]);

  useEffect(() => {
    if (autoSent && input && messages.length === 0 && !isLoading) {
      sendMessage();
    }
  }, [autoSent, input]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    if (sessionState !== "signed-in") {
      toast.error("Please sign in to chat with Plantify AI");
      navigate("/");
      return;
    }

    const userMsg: Msg = { role: "user", content: text };
    setInput("");
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    let assistantSoFar = "";
    const allMessages = [...messages, userMsg];

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("Please sign in to chat");
      }
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          language: localStorage.getItem("app_language") || "en",
          plantContext,
          weatherContext,
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to get response");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "" || !line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              const snapshot = assistantSoFar;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: snapshot } : m));
                }
                return [...prev, { role: "assistant", content: snapshot }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Chat failed");
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, weatherContext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-16">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3 border-b border-border">
        <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-xl hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-serif leading-tight">{t("plantifyAi")}</h1>
            <p className="text-[10px] text-muted-foreground">{t("plantCareAssistant")}</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="ml-auto p-2 rounded-xl hover:bg-muted text-muted-foreground"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && sessionState === "signed-out" && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-16">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-serif text-lg">Sign in to chat</h2>
            <p className="text-sm text-muted-foreground max-w-[260px]">
              Plantify AI needs an account so it can remember your garden and personalize advice.
            </p>
            <Button onClick={() => navigate("/")} className="rounded-xl mt-2">
              Sign in to continue
            </Button>
          </div>
        )}

        {messages.length === 0 && sessionState !== "signed-out" && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-16">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-serif text-lg">{t("askAnything")}</h2>
            <p className="text-sm text-muted-foreground max-w-[260px]">{t("chatHelpText")}</p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {[t("suggestedQ1"), t("suggestedQ2"), t("suggestedQ3")].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
            <button
              onClick={() => navigate("/chat-diagnostics")}
              className="text-[10px] text-muted-foreground underline mt-3"
            >
              Having issues? Run chat diagnostics
            </button>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-foreground" />
              </div>
            )}
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border bg-card/80 backdrop-blur-xl">
        <div className="flex gap-2 items-end max-w-md mx-auto">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chatPlaceholder")}
            className="rounded-xl resize-none min-h-[44px] max-h-[120px] text-sm"
            rows={1}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading || sessionState !== "signed-in"}
            size="icon"
            className="rounded-xl h-11 w-11 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
