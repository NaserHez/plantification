import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Play, Pause, SkipForward, CalendarClock, CheckCircle2 } from "lucide-react";
import {
  Schedule,
  CareTask,
  TASK_META,
  computeNextDue,
  defaultIntervalFor,
  daysUntil,
} from "@/lib/care-schedule";

interface Props {
  plantId: string;
  wateringFrequency?: string | null;
}

const TASKS: CareTask[] = ["water", "fertilize", "mist", "repot"];

export default function CareSchedulePanel({ plantId, wateringFrequency }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await (supabase as any)
      .from("care_schedules")
      .select("*")
      .eq("plant_id", plantId);
    setSchedules((data || []) as Schedule[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [plantId]);

  const ensureRow = async (task: CareTask): Promise<Schedule | null> => {
    const existing = schedules.find((s) => s.task_type === task);
    if (existing) return existing;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const interval = defaultIntervalFor(task, wateringFrequency);
    const next_due_at = computeNextDue(task, interval).toISOString();
    const { data, error } = await (supabase as any)
      .from("care_schedules")
      .insert({
        plant_id: plantId,
        user_id: user.id,
        task_type: task,
        interval_days: interval,
        next_due_at,
        is_paused: false,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    setSchedules((prev) => [...prev, data as Schedule]);
    return data as Schedule;
  };

  const markDone = async (task: CareTask) => {
    setBusy(task);
    const row = await ensureRow(task);
    if (!row) { setBusy(null); return; }
    const now = new Date();
    const next = computeNextDue(task, row.interval_days, now).toISOString();
    const { error } = await (supabase as any)
      .from("care_schedules")
      .update({ last_done_at: now.toISOString(), next_due_at: next })
      .eq("id", row.id);
    if (!error) {
      setSchedules((s) => s.map((x) => x.id === row.id ? { ...x, last_done_at: now.toISOString(), next_due_at: next } : x));
      await (supabase as any).rpc("record_care_action", { _plant: plantId });
      toast.success(`${TASK_META[task].label} logged`);
    }
    setBusy(null);
  };

  const postpone = async (task: CareTask, days: number) => {
    const row = await ensureRow(task);
    if (!row) return;
    const next = new Date(new Date(row.next_due_at).getTime() + days * 86400000).toISOString();
    await (supabase as any).from("care_schedules").update({ next_due_at: next }).eq("id", row.id);
    setSchedules((s) => s.map((x) => x.id === row.id ? { ...x, next_due_at: next } : x));
    toast.success(`Postponed ${days}d`);
  };

  const togglePause = async (task: CareTask) => {
    const row = await ensureRow(task);
    if (!row) return;
    const { error } = await (supabase as any)
      .from("care_schedules")
      .update({ is_paused: !row.is_paused })
      .eq("id", row.id);
    if (!error) setSchedules((s) => s.map((x) => x.id === row.id ? { ...x, is_paused: !x.is_paused } : x));
  };

  const updateInterval = async (task: CareTask, val: number) => {
    if (!val || val < 1) return;
    const row = await ensureRow(task);
    if (!row) return;
    await (supabase as any).from("care_schedules").update({ interval_days: val }).eq("id", row.id);
    setSchedules((s) => s.map((x) => x.id === row.id ? { ...x, interval_days: val } : x));
  };

  if (loading) {
    return <div className="p-4 rounded-2xl bg-accent/40 border border-border flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>;
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-4 space-y-3" aria-labelledby="care-schedule-title">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-primary" />
        <h3 id="care-schedule-title" className="font-serif text-base">Care schedule</h3>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Auto-adjusts for the season. Edit intervals or postpone anytime.
      </p>

      <div className="space-y-2">
        {TASKS.map((task) => {
          const row = schedules.find((s) => s.task_type === task);
          const interval = row?.interval_days ?? defaultIntervalFor(task, wateringFrequency);
          const days = row ? daysUntil(row.next_due_at) : null;
          const meta = TASK_META[task];
          const overdue = row && !row.is_paused && days !== null && days <= 0;

          return (
            <div key={task} className="rounded-xl border border-border/60 p-2.5 bg-background/50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span aria-hidden className="text-lg">{meta.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-tight">{meta.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {row?.is_paused
                        ? "Paused"
                        : days === null
                          ? "Not scheduled yet"
                          : overdue
                            ? `Overdue by ${Math.abs(days)}d`
                            : days === 0
                              ? "Due today"
                              : `In ${days}d`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <label className="text-[10px] text-muted-foreground">Every</label>
                  <Input
                    type="number"
                    min={1}
                    value={interval}
                    onChange={(e) => updateInterval(task, parseInt(e.target.value, 10))}
                    className="w-14 h-7 text-xs rounded-lg"
                    aria-label={`${meta.label} interval in days`}
                  />
                  <span className="text-[10px] text-muted-foreground">d</span>
                </div>
              </div>
              <div className="flex gap-1.5 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs rounded-lg gap-1 flex-1"
                  onClick={() => markDone(task)}
                  disabled={busy === task}
                  aria-label={`Mark ${meta.label.toLowerCase()} as done`}
                >
                  {busy === task ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  Done
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs rounded-lg gap-1"
                  onClick={() => postpone(task, 3)}
                  aria-label={`Postpone ${meta.label.toLowerCase()} three days`}
                >
                  <SkipForward className="w-3 h-3" /> +3d
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs rounded-lg gap-1"
                  onClick={() => togglePause(task)}
                  aria-label={row?.is_paused ? `Resume ${meta.label.toLowerCase()}` : `Pause ${meta.label.toLowerCase()}`}
                >
                  {row?.is_paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
