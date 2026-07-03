import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";

// Simple TOTP (Authenticator app) enrollment via Supabase MFA.
export default function MfaSection() {
  const [factors, setFactors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [pending, setPending] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp || []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator ${new Date().toLocaleDateString()}`,
      });
      if (error) throw error;
      setPending({
        factorId: data.id,
        qr: (data as any).totp?.qr_code || "",
        secret: (data as any).totp?.secret || "",
      });
    } catch (e: any) {
      toast.error(e.message || "Could not start MFA enrollment");
    } finally {
      setEnrolling(false);
    }
  };

  const verify = async () => {
    if (!pending || code.length < 6) return;
    setBusy(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: pending.factorId });
      if (challenge.error) throw challenge.error;
      const verify = await supabase.auth.mfa.verify({
        factorId: pending.factorId,
        challengeId: challenge.data.id,
        code,
      });
      if (verify.error) throw verify.error;
      toast.success("Two-factor authentication enabled");
      setPending(null);
      setCode("");
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  const cancelPending = async () => {
    if (!pending) return;
    try { await supabase.auth.mfa.unenroll({ factorId: pending.factorId }); } catch { /* noop */ }
    setPending(null);
    setCode("");
  };

  const remove = async (factorId: string) => {
    if (!confirm("Remove this authenticator? You'll lose 2FA protection.")) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast.success("Authenticator removed");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async () => {
    if (!pending) return;
    try {
      await navigator.clipboard.writeText(pending.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  const verified = factors.filter((f) => f.status === "verified");

  return (
    <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
      <h2 className="font-serif text-lg flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-primary" /> Two-factor authentication
      </h2>
      <p className="text-xs text-muted-foreground">
        Adds a one-time code from an authenticator app (e.g. 1Password, Google
        Authenticator, Authy) on top of your password.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : verified.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-primary">
            <ShieldCheck className="w-4 h-4" /> 2FA is on
          </div>
          {verified.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
              <div>
                <div className="font-medium">{f.friendly_name || "Authenticator"}</div>
                <div className="text-[10px] text-muted-foreground">
                  Added {new Date(f.created_at).toLocaleDateString()}
                </div>
              </div>
              <Button
                onClick={() => remove(f.id)}
                variant="outline"
                size="sm"
                disabled={busy}
                className="rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <ShieldOff className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : pending ? (
        <div className="space-y-3">
          {pending.qr && (
            <div className="rounded-xl bg-background border border-border p-3 flex justify-center">
              {/* QR is returned as an SVG data URL */}
              <img src={pending.qr} alt="Scan with your authenticator app" className="w-40 h-40" />
            </div>
          )}
          <div className="text-xs">
            <Label className="text-xs text-muted-foreground">Or enter this setup key manually</Label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 text-[11px] bg-muted rounded-lg px-2 py-1.5 break-all font-mono">
                {pending.secret}
              </code>
              <Button onClick={copySecret} size="sm" variant="outline" className="rounded-lg">
                {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="totp-code" className="text-xs">Enter the 6-digit code</Label>
            <Input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="rounded-xl h-10 mt-1 tracking-widest font-mono text-center"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={cancelPending} variant="outline" className="flex-1 rounded-xl h-10" disabled={busy}>
              Cancel
            </Button>
            <Button onClick={verify} disabled={busy || code.length !== 6} className="flex-1 rounded-xl h-10">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & enable"}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={startEnroll}
          disabled={enrolling}
          variant="outline"
          className="w-full rounded-xl h-10 gap-2"
        >
          {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Enable authenticator app
        </Button>
      )}
    </div>
  );
}
