import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plant-chat`;

interface CheckResult {
  label: string;
  status: "pass" | "fail" | "warn";
  detail?: string;
}

export default function ChatDiagnosticsPage() {
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);

  const run = async () => {
    setRunning(true);
    const out: CheckResult[] = [];

    // 1. Session
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (sessionErr || !session) {
      out.push({ label: "Session", status: "fail", detail: sessionErr?.message || "No active session — please sign in." });
      setResults(out);
      setRunning(false);
      return;
    }
    out.push({
      label: "Session",
      status: "pass",
      detail: `User ${session.user.email || session.user.id.slice(0, 8)}`,
    });

    // 2. Access token
    const token = session.access_token;
    if (!token) {
      out.push({ label: "Access token", status: "fail", detail: "Token missing from session" });
      setResults(out);
      setRunning(false);
      return;
    }
    out.push({
      label: "Access token",
      status: "pass",
      detail: `Present (${token.length} chars, exp ${session.expires_at ? new Date(session.expires_at * 1000).toLocaleTimeString() : "unknown"})`,
    });

    // 3. Edge function reachability
    setResults([...out]);
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "ping" }],
          language: "en",
        }),
      });
      if (resp.status === 401) {
        out.push({ label: "Edge function", status: "fail", detail: "401 Unauthorized — token rejected" });
      } else if (resp.status === 429) {
        out.push({ label: "Edge function", status: "warn", detail: "429 Rate limited" });
      } else if (resp.status >= 500) {
        const txt = await resp.text().catch(() => "");
        out.push({ label: "Edge function", status: "fail", detail: `${resp.status} server error ${txt.slice(0, 120)}` });
      } else if (!resp.ok) {
        out.push({ label: "Edge function", status: "fail", detail: `HTTP ${resp.status}` });
      } else {
        out.push({ label: "Edge function", status: "pass", detail: `HTTP ${resp.status} OK` });
      }
    } catch (e: any) {
      out.push({ label: "Edge function", status: "fail", detail: e.message || "Network error" });
    }

    setResults(out);
    setRunning(false);
  };

  const icon = (s: CheckResult["status"]) => {
    if (s === "pass") return <CheckCircle2 className="w-5 h-5 text-primary" />;
    if (s === "warn") return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    return <XCircle className="w-5 h-5 text-destructive" />;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-4 pb-2 flex items-center gap-3 border-b border-border">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-serif">Chat Diagnostics</h1>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        <p className="text-sm text-muted-foreground">
          Runs a quick health check of your session and the chat backend. Useful when the AI Chat returns
          errors.
        </p>
        <Button onClick={run} disabled={running} className="w-full rounded-xl">
          {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {running ? "Running…" : "Run diagnostics"}
        </Button>

        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className="flex items-start gap-3 bg-card border border-border/50 rounded-xl p-3"
            >
              {icon(r.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{r.label}</p>
                {r.detail && <p className="text-xs text-muted-foreground break-all">{r.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
