import { ClientOnly, createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — Trendy Naija" },
      { name: "description", content: "Sign in to Nigeria's AI Trend Intelligence Platform." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ClientOnly fallback={<div className="min-h-screen bg-background" />}>
      <AuthPage />
    </ClientOnly>
  ),
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Account created. You can sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-sidebar text-sidebar-foreground p-12">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-sidebar-primary flex items-center justify-center shadow-lg">
            <Flame className="w-6 h-6 text-sidebar-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold text-lg tracking-tight">Trendy Naija</div>
            <div className="text-[11px] uppercase tracking-widest text-sidebar-foreground/60">
              AI Trend Intelligence
            </div>
          </div>
        </div>

        <div className="space-y-6 max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Discover what <span className="text-primary">Nigeria</span> is talking about.
          </h2>
          <p className="text-sidebar-foreground/70 text-sm leading-relaxed">
            Trendy Naija discovers, analyzes and explains what is currently trending —
            starting with Imo State, expanding across the 36 states and FCT.
          </p>
          <ul className="space-y-2 text-sm text-sidebar-foreground/70">
            <li>• Multi-source trend detection</li>
            <li>• AI-powered clustering & summarization</li>
            <li>• State and LGA level intelligence</li>
          </ul>
        </div>

        <div className="text-xs text-sidebar-foreground/50">
          © {new Date().getFullYear()} Trendy Naija
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Flame className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="font-semibold tracking-tight">Trendy Naija</div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 mb-8">
            {mode === "signin"
              ? "Sign in to access the trend intelligence platform."
              : "Get access as a viewer. Admins are provisioned separately."}
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-xs text-muted-foreground text-center">
            {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              className="text-primary font-medium hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>

          <p className="mt-8 text-[11px] text-muted-foreground text-center">
            <Link to="/" className="hover:text-foreground">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
