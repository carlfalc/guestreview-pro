import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [profile, setProfile] = useState<{ full_name?: string; timezone?: string; language?: string; theme?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.user.id).single();
      setProfile(data ?? {});
    })();
  }, []);

  async function save() {
    setLoading(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { error } = await supabase.from("profiles").update({
      full_name: profile?.full_name ?? null,
      timezone: profile?.timezone ?? "UTC",
      language: profile?.language ?? "en",
      theme: profile?.theme ?? "light",
    }).eq("id", user.user.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    if (profile?.theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }

  return (
    <div className="animate-fade-in-up space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Preferences and personalization.</p>
      </div>

      <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={profile?.full_name ?? ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} className="rounded-xl"/>
          </div>
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Input value={profile?.timezone ?? "UTC"} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} className="rounded-xl"/>
          </div>
          <div className="space-y-1.5">
            <Label>Language</Label>
            <Select value={profile?.language ?? "en"} onValueChange={(v) => setProfile({ ...profile, language: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="it">Italiano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Appearance</Label>
            <Select value={profile?.theme ?? "light"} onValueChange={(v) => setProfile({ ...profile, theme: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex justify-end">
            <Button onClick={save} disabled={loading} className="rounded-full">
              {loading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
