import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Leaf, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";

// RFC-5322-lite email pattern — good enough for instant client feedback.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Small list of the most breached passwords to block outright (OWASP guidance).
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "qwerty",
  "qwerty123", "111111", "iloveyou", "abc123", "letmein", "welcome",
  "admin", "monkey", "dragon", "sunshine", "princess", "football",
]);

type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; tone: string };

function scorePassword(pw: string): Strength {
  if (!pw) return { score: 0, label: "", tone: "bg-muted" };
  if (COMMON_PASSWORDS.has(pw.toLowerCase()))
    return { score: 1, label: "Too common", tone: "bg-destructive" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  const score = Math.min(4, s) as Strength["score"];
  const labels = ["", "Weak", "Fair", "Strong", "Excellent"];
  const tones = ["bg-muted", "bg-destructive", "bg-sun", "bg-primary", "bg-primary"];
  return { score, label: labels[score], tone: tones[score] };
}

function friendlyAuthError(msg: string, mode: "login" | "signup"): string {
  const m = msg.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already"))
    return "This email is already in use. Try signing in instead.";
  if (m.includes("invalid login") || m.includes("invalid credentials"))
    return "Incorrect email or password. Please try again.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email address, then sign in.";
  if (m.includes("weak") || m.includes("password should"))
    return "Password is too weak. Use at least 8 characters with a mix of letters, numbers, and symbols.";
  if (m.includes("rate") || m.includes("too many"))
    return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("network") || m.includes("fetch"))
    return "Network error. Check your connection and try again.";
  return mode === "signup" ? `Could not create account: ${msg}` : `Could not sign in: ${msg}`;
}

export default function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { t } = useLanguage();

  const emailValid = EMAIL_RE.test(email.trim());
  const strength = useMemo(() => scorePassword(password), [password]);
  const passwordValid = mode === "signup"
    ? password.length >= 8 && strength.score >= 2 && !COMMON_PASSWORDS.has(password.toLowerCase())
    : password.length >= 1;

  const emailError = touched.email && !emailValid ? "Please enter a valid email address." : "";
  const passwordError = touched.password && mode === "signup" && password.length > 0 && !passwordValid
    ? (password.length < 8 ? "Use at least 8 characters." : "Please choose a stronger password.")
    : "";

  const canSubmit = mode === "forgot"
    ? emailValid && !loading
    : emailValid && passwordValid && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!canSubmit) return;
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(t("resetEmailSent"));
        setMode("login");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success("Welcome back!");
      } else {
        const { error, data } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.user && !data.session) {
          toast.success(t("checkEmail"));
        } else {
          toast.success("Account created! Welcome to your garden.");
        }
      }
    } catch (err: any) {
      toast.error(friendlyAuthError(err?.message ?? "Something went wrong.", mode === "forgot" ? "login" : mode));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
    } catch (err: any) {
      toast.error(err.message || "Google sign-in failed");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Leaf className="w-8 h-8 text-primary animate-leaf-sway" />
          </div>
          <h1 className="text-3xl font-serif">{t("authTitle")}</h1>
          <p className="text-muted-foreground mt-1">{t("authSubtitle")}</p>
          {mode === "signup" && (
            <p className="text-xs text-muted-foreground mt-3">
              Just email + password to get started — you can add your plant interests later.
            </p>
          )}
        </div>

        {mode === "forgot" ? (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <p className="text-sm text-muted-foreground text-center">{t("forgotPasswordDesc")}</p>
            <div className="space-y-2">
              <Label htmlFor="email">
                {t("email")} <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((s) => ({ ...s, email: true }))}
                placeholder="hello@garden.com"
                aria-required="true"
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "email-error" : undefined}
                required
                className="h-11 rounded-xl"
              />
              {emailError && (
                <p id="email-error" role="alert" className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {emailError}
                </p>
              )}
            </div>
            <Button type="submit" disabled={!canSubmit} className="w-full h-11 rounded-xl text-base">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t("sendResetLink")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <button type="button" onClick={() => setMode("login")} className="text-primary font-medium hover:underline">
                {t("backToLogin")}
              </button>
            </p>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">
                  {t("email")} <span className="text-destructive" aria-hidden>*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((s) => ({ ...s, email: true }))}
                  placeholder="hello@garden.com"
                  aria-required="true"
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "email-error" : undefined}
                  required
                  className="h-11 rounded-xl"
                />
                {emailError && (
                  <p id="email-error" role="alert" className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {emailError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">
                    {t("password")} <span className="text-destructive" aria-hidden>*</span>
                  </Label>
                  {mode === "login" && (
                    <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">
                      {t("forgotPassword")}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((s) => ({ ...s, password: true }))}
                    placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    aria-required="true"
                    aria-invalid={!!passwordError}
                    aria-describedby={mode === "signup" ? "password-help" : undefined}
                    required
                    minLength={mode === "signup" ? 8 : 1}
                    className="h-11 rounded-xl pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {mode === "signup" && (
                  <div id="password-help" className="space-y-1.5 pt-1">
                    <div className="flex gap-1" aria-hidden>
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            i <= strength.score ? strength.tone : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={
                          strength.score >= 3
                            ? "text-primary font-medium"
                            : strength.score >= 2
                              ? "text-sun font-medium"
                              : "text-muted-foreground"
                        }
                        role="status"
                        aria-live="polite"
                      >
                        {password ? `Strength: ${strength.label}` : "Use 8+ characters — a passphrase works best"}
                      </span>
                      {password && strength.score >= 3 && (
                        <span className="text-primary flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Good
                        </span>
                      )}
                    </div>
                    {passwordError && (
                      <p role="alert" className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {passwordError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Button type="submit" disabled={!canSubmit} className="w-full h-11 rounded-xl text-base">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {mode === "signup" ? "Creating account…" : "Signing in…"}
                  </span>
                ) : mode === "login" ? (
                  t("signIn")
                ) : (
                  t("createAccount")
                )}
              </Button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">{t("orContinueWith")}</span></div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full h-11 rounded-xl gap-2"
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {t("signInWithGoogle")}
            </Button>

            <p className="text-center text-sm text-muted-foreground mt-6">
              {mode === "login" ? t("noAccount") : t("hasAccount")}{" "}
              <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary font-medium hover:underline">
                {mode === "login" ? t("signUp") : t("signInLink")}
              </button>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
