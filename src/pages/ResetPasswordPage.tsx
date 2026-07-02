import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock, CheckCircle, AlertCircle, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";

function parseHashError(): string | null {
  const h = window.location.hash.replace(/^#/, "");
  if (!h) return null;
  const p = new URLSearchParams(h);
  const d = p.get("error_description") || p.get("error");
  return d ? decodeURIComponent(d.replace(/\+/g, " ")) : null;
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setIsRecovery(true);
    const err = parseHashError();
    if (err) setLinkError(err);

    // If neither recovery nor error resolves within 2s, treat as expired/invalid.
    const timer = setTimeout(() => {
      if (!isRecovery && !linkError) {
        setLinkError("This reset link is missing or expired. Request a new one below.");
      }
    }, 2000);

    return () => { subscription.unsubscribe(); clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) return toast.error(t("passwordsNoMatch"));
    if (password.length < 8) return toast.error("Use at least 8 characters.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      toast.success(t("passwordUpdated"));
      setTimeout(() => navigate("/"), 2000);
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (!resendEmail) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resendEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Reset link sent — check your inbox.");
    } catch (err: any) {
      toast.error(err.message || "Could not send reset link.");
    } finally { setResending(false); }
  };

  if (success) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background px-4">
        <motion.main initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-serif mb-2">{t("passwordUpdated")}</h1>
          <p className="text-muted-foreground">{t("redirectingHome")}</p>
        </motion.main>
      </div>
    );
  }

  if (linkError && !isRecovery) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background px-4">
        <motion.main initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-serif">Reset link problem</h1>
          <p className="text-sm text-muted-foreground">{linkError}</p>

          <div className="text-left space-y-2 pt-2">
            <Label htmlFor="resend-email" className="text-sm">Send a new reset link</Label>
            <div className="flex gap-2">
              <Input id="resend-email" type="email" placeholder="you@garden.com" value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)} className="h-11 rounded-xl" />
              <Button onClick={handleResend} disabled={resending || !resendEmail} className="h-11 rounded-xl gap-1">
                {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Send
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={() => navigate("/")} variant="outline" className="rounded-xl">Back to sign in</Button>
            <a href="mailto:support@plantification.app" className="text-xs text-primary underline">Contact support</a>
          </div>
        </motion.main>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background px-4">
        <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t("loading")}</p>
        </motion.main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <motion.main initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-serif">{t("resetPassword")}</h1>
          <p className="text-muted-foreground mt-1">{t("resetPasswordDesc")}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-pw">{t("newPassword")}</Label>
            <Input id="new-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pw">{t("confirmPassword")}</Label>
            <Input id="confirm-pw" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={8} className="h-11 rounded-xl" />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl text-base">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t("updatePassword")}
          </Button>
        </form>
      </motion.main>
    </div>
  );
}
