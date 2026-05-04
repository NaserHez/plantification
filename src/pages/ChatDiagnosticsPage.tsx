import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, AlertTriangle, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plant-chat`;
const HISTORY_KEY = "chat_diagnostics_history_v1";
const MAX_HISTORY = 10;

interface CheckResult {
  label: string;
  status: "pass" | "fail" | "warn";
  detail?: string;
}

interface LastRequest {
  url: string;
  method: string;
  bodyPreview: string;
  status: number | null;
  ok: boolean;
  durationMs: number;
  responsePreview: string;
  error?: string;
  startedAt: string;
}

interface HistoryEntry {
  id: string;
  ranAt: string;
  results: CheckResult[];
  lastRequest: LastRequest | null;
  overall: "pass" | "fail" | "warn";
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(h: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, MAX_HISTORY)));
  } catch {
    /* ignore */
  }
}

function summarize(results: CheckResult[]): "pass" | "fail" | "warn" {
  if (results.some((r) => r.status === "fail")) return "fail";
  if (results.some((r) => r.status === "warn")) return "warn";
  return "pass";
}

export default function ChatDiagnosticsPage() {
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [lastRequest, setLastRequest] = useState<LastRequest | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showLastReq, setShowLastReq] = useState(true);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const run = async () => {
    setRunning(true);
    const out: CheckResult[] = [];
    let req: LastRequest | null = null;

    // 1. Session
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (sessionErr || !session) {
      out.push({
        label: "Session",
        status: "fail",
        detail: sessionErr?.message || "No active session — please sign in.",
      });
      finalize(out, null);
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
      finalize(out, null);
      return;
    }
    out.push({
      label: "Access token",
      status: "pass",
      detail: `Present (${token.length} chars, exp ${
        session.expires_at ? new Date(session.expires_at * 1000).toLocaleTimeString() : "unknown"
      })`,
    });

    // 3. Edge function
    setResults([...out]);
    const body = JSON.stringify({
      messages: [{ role: "user", content: "ping" }],
      language: "en",
    });
    const startedAt = new Date().toISOString();
    const t0 = performance.now();
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body,
      });
      const durationMs = Math.round(performance.now() - t0);
      const text = await resp.text().catch(() => "");
      req = {
        url: CHAT_URL,
        method: "POST",
        bodyPreview: body.slice(0, 300),
        status: resp.status,
        ok: resp.ok,
        durationMs,
        responsePreview: text.slice(0, 500),
        startedAt,
      };
      if (resp.status === 401) {
        out.push({ label: "Edge function", status: "fail", detail: `401 Unauthorized · ${durationMs} ms` });
      } else if (resp.status === 429) {
        out.push({ label: "Edge function", status: "warn", detail: `429 Rate limited · ${durationMs} ms` });
      } else if (resp.status >= 500) {
        out.push({
          label: "Edge function",
          status: "fail",
          detail: `${resp.status} server error · ${durationMs} ms`,
        });
      } else if (!resp.ok) {
        out.push({ label: "Edge function", status: "fail", detail: `HTTP ${resp.status} · ${durationMs} ms` });
      } else {
        out.push({ label: "Edge function", status: "pass", detail: `HTTP ${resp.status} OK · ${durationMs} ms` });
      }
    } catch (e: any) {
      const durationMs = Math.round(performance.now() - t0);
      req = {
        url: CHAT_URL,
        method: "POST",
        bodyPreview: body.slice(0, 300),
        status: null,
        ok: false,
        durationMs,
        responsePreview: "",
        error: e.message || "Network error",
        startedAt,
      };
      out.push({ label: "Edge function", status: "fail", detail: e.message || "Network error" });
    }

    finalize(out, req);
  };

  const finalize = (out: CheckResult[], req: LastRequest | null) => {
    setResults(out);
    setLastRequest(req);
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ranAt: new Date().toISOString(),
      results: out,
      lastRequest: req,
      overall: summarize(out),
    };
    const next = [entry, ...history].slice(0, MAX_HISTORY);
    setHistory(next);
    saveHistory(next);
    setRunning(false);
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const icon = (s: CheckResult["status"]) => {
    if (s === "pass") return <CheckCircle2 className="w-5 h-5 text-primary" />;
    if (s === "warn") return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    return <XCircle className="w-5 h-5 text-destructive" />;
  };

  const dot = (s: "pass" | "fail" | "warn") => {
    const cls =
      s === "pass" ? "bg-primary" : s === "warn" ? "bg-yellow-500" : "bg-destructive";
    return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;
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

        {/* Current results */}
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

        {/* Last request/response */}
        {lastRequest && (
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowLastReq((v) => !v)}
              className="w-full flex items-center justify-between p-3 hover:bg-muted/40"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Last chat request</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    lastRequest.ok
                      ? "bg-primary/10 text-primary"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {lastRequest.status ?? "ERR"} · {lastRequest.durationMs}ms
                </span>
              </div>
              {showLastReq ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showLastReq && (
              <div className="px-3 pb-3 space-y-2 text-xs">
                <div>
                  <p className="text-muted-foreground mb-0.5">Endpoint</p>
                  <p className="font-mono break-all">{lastRequest.method} {lastRequest.url}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Started</p>
                  <p className="font-mono">{new Date(lastRequest.startedAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Request body</p>
                  <pre className="bg-muted/50 rounded-lg p-2 whitespace-pre-wrap break-all font-mono text-[11px]">
                    {lastRequest.bodyPreview}
                  </pre>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">
                    Response {lastRequest.status !== null ? `(${lastRequest.status})` : "(network error)"}
                  </p>
                  <pre className="bg-muted/50 rounded-lg p-2 whitespace-pre-wrap break-all font-mono text-[11px] max-h-48 overflow-auto">
                    {lastRequest.error || lastRequest.responsePreview || "(empty body)"}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History panel */}
        {history.length > 0 && (
          <div className="bg-card border border-border/50 rounded-xl">
            <div className="flex items-center justify-between p-3 border-b border-border/50">
              <p className="text-sm font-semibold">Run history</p>
              <button
                onClick={clearHistory}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            </div>
            <ul className="divide-y divide-border/50">
              {history.map((h) => {
                const isOpen = !!expanded[h.id];
                return (
                  <li key={h.id}>
                    <button
                      onClick={() => setExpanded((p) => ({ ...p, [h.id]: !isOpen }))}
                      className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/40"
                    >
                      {dot(h.overall)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">
                          {new Date(h.ranAt).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {h.lastRequest
                            ? `${h.lastRequest.status ?? "ERR"} · ${h.lastRequest.durationMs}ms`
                            : "No request"}
                          {" · "}
                          {h.results.filter((r) => r.status === "pass").length}/{h.results.length} passed
                        </p>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 space-y-1.5">
                        {h.results.map((r, i) => (
                          <div key={i} className="flex items-start gap-2 text-[11px]">
                            {dot(r.status)}
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold">{r.label}</span>
                              {r.detail && (
                                <span className="text-muted-foreground"> — {r.detail}</span>
                              )}
                            </div>
                          </div>
                        ))}
                        {h.lastRequest && (
                          <pre className="bg-muted/50 rounded-lg p-2 whitespace-pre-wrap break-all font-mono text-[10px] max-h-32 overflow-auto mt-1">
                            {h.lastRequest.error || h.lastRequest.responsePreview || "(empty body)"}
                          </pre>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
