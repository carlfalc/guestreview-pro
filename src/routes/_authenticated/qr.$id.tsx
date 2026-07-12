import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Download, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/_authenticated/qr/$id")({
  component: QrDetail,
});

function QrDetail() {
  const { id } = useParams({ from: "/_authenticated/qr/$id" });
  const qc = useQueryClient();
  const svgRef = useRef<HTMLDivElement>(null);

  const { data: qr } = useQuery({
    queryKey: ["qr", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qr_codes")
        .select("*, businesses(name, brand_primary, logo_url), locations(name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [style, setStyle] = useState<"square" | "circle" | "rounded">("square");
  const [fg, setFg] = useState<string>(qr?.fg_color ?? "#000000");
  const [bg, setBg] = useState<string>(qr?.bg_color ?? "#ffffff");
  const [label, setLabel] = useState<string>(qr?.label ?? "");

  const shortUrl = useMemo(() => {
    if (!qr) return "";
    return `${typeof window !== "undefined" ? window.location.origin : ""}/r/${qr.short_code}`;
  }, [qr]);

  async function saveDesign() {
    if (!qr) return;
    const { error } = await supabase
      .from("qr_codes")
      .update({ style, fg_color: fg, bg_color: bg, label })
      .eq("id", qr.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["qr", id] });
  }

  function downloadSvg() {
    const svg = svgRef.current?.querySelector("svg");
    if (!svg) return;
    const src = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([src], { type: "image/svg+xml" });
    triggerDownload(URL.createObjectURL(blob), `${qr?.short_code}.svg`);
  }

  function downloadPng() {
    const svg = svgRef.current?.querySelector("svg");
    if (!svg) return;
    const src = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const svgBlob = new Blob([src], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const size = 1024;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob((b) => {
        if (b) triggerDownload(URL.createObjectURL(b), `${qr?.short_code}.png`);
      });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function copyUrl() {
    navigator.clipboard.writeText(shortUrl);
    toast.success("Copied");
  }

  if (!qr) return <div className="h-40 rounded-3xl bg-muted shimmer" />;
  const biz = qr.businesses as { name?: string; brand_primary?: string; logo_url?: string } | null;

  return (
    <div className="animate-fade-in-up space-y-6">
      <Link to="/businesses/$id" params={{ id: qr.business_id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to business
      </Link>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{qr.label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {biz?.name} · {(qr.locations as { name?: string } | null)?.name ?? "No location"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
          <CardContent className="p-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} className="rounded-xl"/>
              </div>
              <div className="space-y-1.5">
                <Label>Style</Label>
                <Select value={style} onValueChange={(v) => setStyle(v as "square" | "circle" | "rounded")}>
                  <SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="rounded">Rounded</SelectItem>
                    <SelectItem value="circle">Circle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Foreground</Label>
                <Input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-10 rounded-xl p-1"/>
              </div>
              <div className="space-y-1.5">
                <Label>Background</Label>
                <Input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-10 rounded-xl p-1"/>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Short link</p>
                <div className="flex items-center gap-2 text-sm font-mono">
                  <span>{shortUrl}</span>
                  <button onClick={copyUrl} className="rounded-md p-1 hover:bg-accent"><Copy className="h-3.5 w-3.5"/></button>
                  <a href={shortUrl} target="_blank" rel="noreferrer" className="rounded-md p-1 hover:bg-accent"><ExternalLink className="h-3.5 w-3.5"/></a>
                </div>
              </div>
              <Button onClick={saveDesign} className="rounded-full">Save design</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
          <CardContent className="p-6">
            <div
              ref={svgRef}
              className="mx-auto flex aspect-square w-full items-center justify-center overflow-hidden p-4"
              style={{
                background: bg,
                borderRadius: style === "circle" ? "9999px" : style === "rounded" ? "2rem" : "1rem",
              }}
            >
              <QRCodeSVG
                value={shortUrl}
                size={280}
                fgColor={fg}
                bgColor={bg}
                level="H"
                imageSettings={
                  biz?.logo_url
                    ? { src: biz.logo_url, height: 48, width: 48, excavate: true }
                    : undefined
                }
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={downloadPng} className="rounded-full"><Download className="mr-1 h-4 w-4"/>PNG</Button>
              <Button variant="outline" onClick={downloadSvg} className="rounded-full"><Download className="mr-1 h-4 w-4"/>SVG</Button>
            </div>
            <div className="mt-4 rounded-2xl bg-accent p-3 text-center text-xs text-accent-foreground">
              <span className="font-semibold">{qr.scans_count}</span> total scans
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
