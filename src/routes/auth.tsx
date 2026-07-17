import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { QrCode } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function signInEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/dashboard" });
  }

  async function signUpEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — you can sign in now.");
    setMode("signin");
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset email sent.");
    setMode("signin");
  }

  async function google() {
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (res.error) return toast.error(res.error.message ?? "Google sign-in failed");
    if (res.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12 text-white">
      <div className="w-full max-w-md animate-fade-in-up">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 backdrop-blur">
            <QrCode className="h-4 w-4" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">GuestReview Pro</span>
        </Link>

        <p className="text-center text-[11px] font-medium uppercase tracking-[0.28em] text-white/60">
          Branded Google Review QR
        </p>
        <h1
          className="mt-3 text-center text-white"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontStretch: '125%',
            letterSpacing: '-0.04em',
            lineHeight: 0.9,
            fontSize: 'clamp(3rem, 8vw, 5rem)',
          }}
        >
          {mode === 'reset' ? 'RESET' : mode === 'signup' ? 'JOIN' : 'WELCOME'}
        </h1>

        <Card className="mt-8 rounded-3xl border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-center text-base font-medium tracking-tight text-white/80">
              {mode === "reset" ? "Enter your email to receive a reset link" : mode === "signup" ? "Create your account" : "Sign in to continue"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mode !== "reset" && (
              <>
                <Button
                  variant="outline"
                  className="mb-4 w-full rounded-full bg-card"
                  onClick={google}
                  type="button"
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h5.9c-.3 1.4-1 2.5-2.2 3.3v2.8h3.6c2.1-1.9 3.2-4.7 3.2-8.3z"/>
                    <path fill="#34A853" d="M12 23c2.9 0 5.4-1 7.2-2.6l-3.6-2.8c-1 .7-2.3 1.1-3.7 1.1-2.8 0-5.2-1.9-6.1-4.5H2.2v2.9C4 20.5 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.9 14.1c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V6.8H2.2C1.4 8.4 1 10.1 1 12s.4 3.6 1.2 5.2l3.7-3.1z"/>
                    <path fill="#EA4335" d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1C17.4 2.1 14.9 1 12 1 7.7 1 4 3.5 2.2 6.8l3.7 2.9c.9-2.6 3.3-4.3 6.1-4.3z"/>
                  </svg>
                  Continue with Google
                </Button>
                <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  or
                  <div className="h-px flex-1 bg-border" />
                </div>
              </>
            )}

            {mode === "reset" ? (
              <form onSubmit={reset} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="rounded-xl"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full rounded-full">
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="mx-auto block text-xs text-muted-foreground hover:text-foreground"
                >
                  Back to sign in
                </button>
              </form>
            ) : (
              <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
                <TabsList className="grid w-full grid-cols-2 rounded-full">
                  <TabsTrigger value="signin" className="rounded-full">Sign in</TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-full">Sign up</TabsTrigger>
                </TabsList>
                <TabsContent value="signin" className="mt-6">
                  <form onSubmit={signInEmail} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl"/>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <button type="button" onClick={() => setMode("reset")} className="text-xs text-primary hover:underline">Forgot?</button>
                      </div>
                      <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-xl"/>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full rounded-full">
                      {loading ? "Signing in…" : "Sign in"}
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="signup" className="mt-6">
                  <form onSubmit={signUpEmail} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Full name</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="rounded-xl"/>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email2">Email</Label>
                      <Input id="email2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl"/>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password2">Password</Label>
                      <Input id="password2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="rounded-xl"/>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full rounded-full">
                      {loading ? "Creating account…" : "Create account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our terms and privacy policy.
        </p>
      </div>
    </div>
  );
}
