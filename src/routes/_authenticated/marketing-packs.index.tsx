import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus, Copy, Archive, Trash2, Package, Search, RotateCw, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { PACK_TYPES, statusMeta, type PackStatus } from "@/lib/marketing-packs";

export const Route = createFileRoute("/_authenticated/marketing-packs/")({
  component: MarketingPacksList,
});

type PackRow = {
  id: string;
  project_name: string;
  pack_type: string;
  layout_template: string;
  status: string;
  selected_formats: unknown;
  preview_url: string | null;
  updated_at: string;
  archived_at: string | null;
  businesses: { name: string | null } | null;
  qr_codes: { label: string | null; short_code: string | null } | null;
};

function MarketingPacksList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [businessFilter, setBusinessFilter] = useState<string>("all");
  const [packTypeFilter, setPackTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const { data: businesses } = useQuery({
    queryKey: ["businesses-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("businesses").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: packs, isLoading, error, refetch } = useQuery({
    queryKey: ["marketing-packs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_packs")
        .select("id, project_name, pack_type, layout_template, status, selected_formats, preview_url, updated_at, archived_at, business_id, qr_code_id, businesses(name), qr_codes(label, short_code)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (PackRow & { business_id: string; qr_code_id: string })[];
    },
  });

  // Resolve preview_url storage paths to signed URLs so private-bucket thumbnails render.
  const [signedThumbs, setSignedThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    const paths = (packs ?? [])
      .map((p) => p.preview_url)
      .filter((p): p is string => !!p && !p.startsWith("http"));
    if (paths.length === 0) { setSignedThumbs({}); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.storage.from("pack-previews").createSignedUrls(paths, 60 * 60);
      if (cancelled || !data) return;
      const map: Record<string, string> = {};
      data.forEach((r) => { if (r.path && r.signedUrl) map[r.path] = r.signedUrl; });
      setSignedThumbs(map);
    })();
    return () => { cancelled = true; };
  }, [packs]);

  const filtered = useMemo(() => {
    if (!packs) return [];
    return packs.filter((p) => {
      if (statusFilter === "archived" && p.status !== "archived") return false;
      if (statusFilter === "active" && p.status === "archived") return false;
      if (businessFilter !== "all" && (p as { business_id?: string }).business_id !== businessFilter) return false;
      if (packTypeFilter !== "all" && p.pack_type !== packTypeFilter) return false;
      if (search && !p.project_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [packs, statusFilter, businessFilter, packTypeFilter, search]);

  async function duplicatePack(id: string) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return toast.error("Not signed in");
    const { data: src, error } = await supabase.from("marketing_packs").select("*").eq("id", id).single();
    if (error || !src) return toast.error(error?.message ?? "Not found");
    const row = src as Record<string, unknown>;
    const insert = {
      owner_id: userData.user.id,
      business_id: row.business_id,
      qr_code_id: row.qr_code_id,
      project_name: `${row.project_name} (copy)`,
      description: row.description,
      pack_type: row.pack_type,
      layout_template: row.layout_template,
      headline: row.headline,
      support_text: row.support_text,
      cta_text: row.cta_text,
      footer_text: row.footer_text,
      show_business_name: row.show_business_name,
      show_logo: row.show_logo,
      show_stars: row.show_stars,
      show_google_badge: row.show_google_badge,
      selected_formats: row.selected_formats ?? [],
      global_settings: row.global_settings ?? {},
      format_customizations: row.format_customizations ?? {},
      status: "draft",
    };
    const { data, error: err2 } = await supabase.from("marketing_packs").insert(insert as never).select("id").single();
    if (err2 || !data) return toast.error(err2?.message ?? "Duplicate failed");
    toast.success("Duplicated");
    qc.invalidateQueries({ queryKey: ["marketing-packs"] });
    navigate({ to: "/marketing-packs/$id", params: { id: data.id } });
  }

  async function archivePack(id: string, archive: boolean) {
    const { error } = await supabase.from("marketing_packs").update({
      status: archive ? "archived" : "draft",
      archived_at: archive ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(archive ? "Archived" : "Restored");
    qc.invalidateQueries({ queryKey: ["marketing-packs"] });
  }

  async function deletePack(id: string) {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase.storage.from("pack-previews").remove([`${userData.user.id}/${id}.png`]).catch(() => undefined);
    }
    const { error } = await supabase.from("marketing_packs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["marketing-packs"] });
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Marketing Packs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Save, reopen and export complete branded print + digital packs.
          </p>
        </div>
        <Button asChild className="rounded-full">
          <Link to="/marketing-packs/new"><Plus className="mr-1 h-4 w-4"/>New pack</Link>
        </Button>
      </div>

      <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search packs" className="rounded-xl pl-9"/>
            </div>
            <Select value={businessFilter} onValueChange={setBusinessFilter}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Business"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All businesses</SelectItem>
                {(businesses ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={packTypeFilter} onValueChange={setPackTypeFilter}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pack type"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {PACK_TYPES.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading && <div className="h-32 rounded-2xl bg-muted shimmer"/>}

          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-12 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive"/>
              <p className="text-sm font-medium text-destructive">Couldn't load your packs</p>
              <p className="max-w-sm text-xs text-muted-foreground">{(error as Error).message}</p>
              <Button onClick={() => refetch()} className="mt-1 rounded-full" variant="outline">
                <RotateCw className="mr-1 h-4 w-4"/>Retry
              </Button>
            </div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 p-12 text-center">
              <Package className="h-10 w-10 text-muted-foreground"/>
              <p className="text-sm font-medium">No marketing packs yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Create a pack for a business + QR code to save formats, design and copy in one project.
              </p>
              <Button asChild className="mt-2 rounded-full">
                <Link to="/marketing-packs/new"><Plus className="mr-1 h-4 w-4"/>Create your first pack</Link>
              </Button>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const formats = Array.isArray(p.selected_formats) ? (p.selected_formats as string[]) : [];
              const meta = statusMeta(p.status as PackStatus);
              const thumb = p.preview_url
                ? (p.preview_url.startsWith("http") ? p.preview_url : signedThumbs[p.preview_url])
                : null;
              return (
                <div key={p.id} className="group flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/50">
                  <Link to="/marketing-packs/$id" params={{ id: p.id }} className="block">
                    <div className="aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-accent/50 to-accent">
                      {thumb ? (
                        <img src={thumb} alt="" className="h-full w-full object-cover"/>
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <Package className="h-8 w-8"/>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{p.project_name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {p.businesses?.name ?? "—"} · {p.qr_codes?.label ?? p.qr_codes?.short_code ?? "QR"}
                        </p>
                      </div>
                      <Badge variant={meta.badge} className="shrink-0 rounded-full text-[10px]">{meta.label}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                      <Badge variant="outline" className="rounded-full">{PACK_TYPES.find((t) => t.id === p.pack_type)?.label ?? "Custom"}</Badge>
                      <Badge variant="outline" className="rounded-full">{formats.length} formats</Badge>
                      <Badge variant="outline" className="rounded-full">{p.layout_template}</Badge>
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">Edited {new Date(p.updated_at).toLocaleDateString()}</p>
                  </Link>
                  <div className="flex gap-1.5 border-t border-border/60 pt-2">
                    <Button size="sm" variant="ghost" onClick={() => duplicatePack(p.id)} className="flex-1 rounded-full text-[11px]">
                      <Copy className="mr-1 h-3 w-3"/>Duplicate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => archivePack(p.id, p.status !== "archived")} className="flex-1 rounded-full text-[11px]">
                      <Archive className="mr-1 h-3 w-3"/>{p.status === "archived" ? "Restore" : "Archive"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deletePack(p.id)} className="rounded-full text-destructive hover:text-destructive">
                      <Trash2 className="h-3 w-3"/>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
