import { useEffect, useMemo, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Download, Palette, Upload, X, ShieldCheck } from "lucide-react";
import {
  DEFAULT_DESIGN,
  PRESETS,
  computeWarnings,
  contrastRatio,
  mapCornerDot,
  mapCornerSquare,
  type QrDesign,
} from "@/lib/qr-design";
import { toast } from "sonner";

type Props = {
  value: QrDesign;
  onChange: (next: QrDesign) => void;
  url: string;
  logoUrl: string | null;
  onLogoChange: (dataUrl: string | null) => void;
  brandColor?: string | null;
  filenameStem: string;
};

export function QrDesigner({ value, onChange, url, logoUrl, onLogoChange, brandColor, filenameStem }: Props) {
  const previewRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);
  const [decodeOk, setDecodeOk] = useState<boolean | null>(null);

  const options = useMemo(() => buildOptions(value, url, logoUrl), [value, url, logoUrl]);

  // Init once
  useEffect(() => {
    if (qrRef.current || !previewRef.current) return;
    qrRef.current = new QRCodeStyling(options);
    previewRef.current.innerHTML = "";
    qrRef.current.append(previewRef.current);
     
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    qrRef.current?.update(options);
  }, [options]);

  // Attempt to decode the current preview as a scan-safety check
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const qr = qrRef.current;
      if (!qr) return;
      try {
        const blob = await qr.getRawData("png");
        if (!blob || cancelled) return;
        const bitmap = await createImageBitmap(blob as Blob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d")!;
        // Paint white behind for transparent designs so decoder has contrast
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const res = jsQR(img.data, img.width, img.height);
        if (cancelled) return;
        setDecodeOk(!!res && res.data === url);
      } catch {
        if (!cancelled) setDecodeOk(null);
      }
    };
    const t = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [options, url]);

  const warnings = useMemo(() => {
    const list = computeWarnings(value);
    if (decodeOk === false) {
      list.push({
        code: "decode-failed",
        severity: "warn",
        message: "The browser could not decode this preview. Increase contrast, reduce the logo size or increase the margin.",
      });
    }
    return list;
  }, [value, decodeOk]);

  const cr = contrastRatio(value.fg, value.transparentBg ? "#ffffff" : value.bg);

  function patch(p: Partial<QrDesign>) {
    onChange({ ...value, ...p });
  }

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file");
    if (file.size > 512 * 1024) return toast.error("Logo must be under 512 KB");
    const reader = new FileReader();
    reader.onload = () => {
      onLogoChange(String(reader.result));
      patch({ logoEnabled: true });
    };
    reader.readAsDataURL(file);
  }

  async function download(fmt: "png1024" | "png2048" | "svg" | "png-transparent") {
    const qr = qrRef.current;
    if (!qr) return;
    if (fmt === "svg") {
      await qr.download({ name: filenameStem, extension: "svg" });
      return;
    }
    const size = fmt === "png2048" ? 2048 : 1024;
    const transparent = fmt === "png-transparent";
    // Build a fresh instance at the requested size so download resolution is correct
    const opts = buildOptions(
      transparent ? { ...value, transparentBg: true } : value,
      url,
      logoUrl,
      size,
    );
    const one = new QRCodeStyling(opts);
    const blob = (await one.getRawData("png")) as Blob | null;
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${filenameStem}-${fmt}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
        <div
          className="mx-auto flex aspect-square w-full max-w-[320px] items-center justify-center overflow-hidden rounded-2xl"
          style={{
            background: value.transparentBg
              ? "repeating-conic-gradient(#00000010 0% 25%, transparent 0% 50%) 50%/16px 16px"
              : value.bg,
          }}
        >
          <div ref={previewRef} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={() => download("png1024")} className="rounded-full">
            <Download className="mr-1 h-4 w-4" /> PNG 1024
          </Button>
          <Button onClick={() => download("png2048")} className="rounded-full">
            <Download className="mr-1 h-4 w-4" /> PNG 2048
          </Button>
          <Button variant="outline" onClick={() => download("svg")} className="rounded-full">
            <Download className="mr-1 h-4 w-4" /> SVG
          </Button>
          <Button variant="outline" onClick={() => download("png-transparent")} className="rounded-full">
            <Download className="mr-1 h-4 w-4" /> Transparent
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {decodeOk === true && warnings.length === 0 && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              <ShieldCheck className="h-4 w-4" /> Preview scanned successfully in-browser (contrast {cr.toFixed(2)}).
            </div>
          )}
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w.message}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)] space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Presets</p>
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => onChange(p.apply({ ...value }, brandColor))}
            >
              {p.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground" onClick={() => onChange({ ...DEFAULT_DESIGN })}>
            Reset
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dot style">
            <Select value={value.dotStyle} onValueChange={(v) => patch({ dotStyle: v as QrDesign["dotStyle"] })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="square">Square</SelectItem>
                <SelectItem value="rounded">Rounded</SelectItem>
                <SelectItem value="dots">Circular</SelectItem>
                <SelectItem value="classy">Classy</SelectItem>
                <SelectItem value="classy-rounded">Classy rounded</SelectItem>
                <SelectItem value="extra-rounded">Extra rounded</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Corner frame">
            <Select value={value.cornerSquareStyle} onValueChange={(v) => patch({ cornerSquareStyle: v as QrDesign["cornerSquareStyle"] })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="square">Square</SelectItem>
                <SelectItem value="rounded">Rounded</SelectItem>
                <SelectItem value="extra-rounded">Extra rounded</SelectItem>
                <SelectItem value="dot">Dot</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Corner dot">
            <Select value={value.cornerDotStyle} onValueChange={(v) => patch({ cornerDotStyle: v as QrDesign["cornerDotStyle"] })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="square">Square</SelectItem>
                <SelectItem value="dot">Circular</SelectItem>
                <SelectItem value="rounded">Rounded</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Error correction">
            <Select value={value.errorCorrection} onValueChange={(v) => patch({ errorCorrection: v as QrDesign["errorCorrection"] })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="L">L — 7%</SelectItem>
                <SelectItem value="M">M — 15%</SelectItem>
                <SelectItem value="Q">Q — 25%</SelectItem>
                <SelectItem value="H">H — 30% (recommended with logo)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Colour mode">
            <Select value={value.colorMode} onValueChange={(v) => patch({ colorMode: v as QrDesign["colorMode"] })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Solid colour</SelectItem>
                <SelectItem value="gradient">Two-colour gradient</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Foreground">
            <Input type="color" value={value.fg} onChange={(e) => patch({ fg: e.target.value })} className="h-10 rounded-xl p-1" />
          </Field>
          {value.colorMode === "gradient" && (
            <>
              <Field label="Gradient colour 2">
                <Input type="color" value={value.fg2} onChange={(e) => patch({ fg2: e.target.value })} className="h-10 rounded-xl p-1" />
              </Field>
              <Field label="Gradient type">
                <Select value={value.gradientType} onValueChange={(v) => patch({ gradientType: v as QrDesign["gradientType"] })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linear">Linear</SelectItem>
                    <SelectItem value="radial">Radial</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
          <Field label="Background">
            <Input
              type="color"
              value={value.bg}
              disabled={value.transparentBg}
              onChange={(e) => patch({ bg: e.target.value })}
              className="h-10 rounded-xl p-1 disabled:opacity-40"
            />
          </Field>
          <Field label="Transparent background">
            <div className="flex h-10 items-center">
              <Switch checked={value.transparentBg} onCheckedChange={(v) => patch({ transparentBg: v })} />
            </div>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Quiet zone (${value.margin}px)`}>
            <Slider value={[value.margin]} min={0} max={40} step={1} onValueChange={([v]) => patch({ margin: v })} />
          </Field>
          <Field label="Contrast">
            <div className="flex h-10 items-center text-xs text-muted-foreground">
              Ratio <span className={`ml-1 font-semibold ${cr < 4 ? "text-amber-300" : "text-emerald-300"}`}>{cr.toFixed(2)}</span>
              <span className="ml-2">/ 4+ recommended</span>
            </div>
          </Field>
        </div>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Logo</p>
            <p className="text-xs text-muted-foreground">Overlay a brand mark in the centre of the QR.</p>
          </div>
          <Switch checked={value.logoEnabled} onCheckedChange={(v) => patch({ logoEnabled: v })} />
        </div>

        {value.logoEnabled && (
          <>
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-background">
                {logoUrl ? <img src={logoUrl} alt="logo" className="h-full w-full object-contain" /> : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">No logo</div>
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent">
                <Upload className="h-3.5 w-3.5" /> Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                />
              </label>
              {logoUrl && (
                <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground" onClick={() => onLogoChange(null)}>
                  <X className="mr-1 h-3.5 w-3.5" /> Remove
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`Logo size (${Math.round(value.logoSize * 100)}%)`}>
                <Slider value={[value.logoSize * 100]} min={10} max={40} step={1} onValueChange={([v]) => patch({ logoSize: v / 100 })} />
              </Field>
              <Field label={`Logo margin (${value.logoMargin}px)`}>
                <Slider value={[value.logoMargin]} min={0} max={20} step={1} onValueChange={([v]) => patch({ logoMargin: v })} />
              </Field>
              <Field label="White pad behind logo">
                <div className="flex h-10 items-center">
                  <Switch checked={value.logoWhitePad} onCheckedChange={(v) => patch({ logoWhitePad: v })} />
                </div>
              </Field>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function buildOptions(d: QrDesign, url: string, logoUrl: string | null, size = 320) {
  const fgColorOption = d.colorMode === "gradient"
    ? {
        gradient: {
          type: d.gradientType,
          rotation: d.gradientRotation,
          colorStops: [
            { offset: 0, color: d.fg },
            { offset: 1, color: d.fg2 },
          ],
        },
      }
    : { color: d.fg };

  const bgColorOption = d.transparentBg
    ? { color: "rgba(0,0,0,0)" }
    : { color: d.bg };

  return {
    width: size,
    height: size,
    type: "svg" as const,
    data: url || " ",
    margin: d.margin,
    qrOptions: { errorCorrectionLevel: d.errorCorrection },
    image: d.logoEnabled && logoUrl ? logoUrl : undefined,
    imageOptions: {
      hideBackgroundDots: d.logoWhitePad,
      imageSize: d.logoSize,
      margin: d.logoMargin,
      crossOrigin: "anonymous" as const,
    },
    dotsOptions: { type: d.dotStyle, ...fgColorOption },
    backgroundOptions: bgColorOption,
    cornersSquareOptions: { type: mapCornerSquare(d.cornerSquareStyle), color: d.fg },
    cornersDotOptions: { type: mapCornerDot(d.cornerDotStyle), color: d.fg },
  };
}
