import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTrack } from "@/hooks/use-analytics";
import {
  PRINT_INTEREST_PRODUCTS,
  PRINT_MATERIAL_OPTIONS,
  PRINT_QUANTITY_OPTIONS,
  PRINT_SIZE_OPTIONS,
  PRINT_TIMEFRAME_OPTIONS,
  type PrintInterestSource,
} from "@/lib/print-interest";
import {
  getPrintInterestContext,
  submitPrintInterest,
} from "@/lib/print-interest.functions";

const UNSET = "__unset__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: PrintInterestSource;
  /** Business the user is currently working in, when known. */
  businessId?: string | null;
}

/** Short demand form. Captures interest only — it can never create an order. */
export function PrintWaitlistDialog({ open, onOpenChange, source, businessId }: Props) {
  const track = useTrack();
  const qc = useQueryClient();
  const contextFn = useServerFn(getPrintInterestContext);
  const submitFn = useServerFn(submitPrintInterest);

  const contextQ = useQuery({
    queryKey: ["print-interest-context"],
    queryFn: () => contextFn(),
    enabled: open,
  });

  const existing = useMemo(
    () => contextQ.data?.entries.find((e) => e.source === source) ?? null,
    [contextQ.data, source],
  );

  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [products, setProducts] = useState<string[]>([]);
  const [business, setBusiness] = useState<string>(UNSET);
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [quantity, setQuantity] = useState(UNSET);
  const [size, setSize] = useState(UNSET);
  const [material, setMaterial] = useState(UNSET);
  const [timeframe, setTimeframe] = useState(UNSET);
  const [comments, setComments] = useState("");
  const [consent, setConsent] = useState(true);

  // Prefill once the context lands, and reset when the dialog closes.
  useEffect(() => {
    if (!open) {
      setReady(false);
      setDone(false);
      return;
    }
    if (ready || !contextQ.data) return;
    const ctx = contextQ.data;
    setProducts(existing?.productKeys ?? []);
    setBusiness(existing?.businessId ?? businessId ?? ctx.businesses[0]?.id ?? UNSET);
    setEmail(existing?.email ?? ctx.email ?? "");
    setCountry(existing?.countryCode ?? ctx.countryCode ?? "");
    setQuantity(existing?.expectedQuantity ?? UNSET);
    setSize(existing?.preferredSize ?? UNSET);
    setMaterial(existing?.preferredMaterial ?? UNSET);
    setTimeframe(existing?.desiredTimeframe ?? UNSET);
    setComments(existing?.comments ?? "");
    setConsent(existing ? existing.contactConsent : true);
    setReady(true);
  }, [open, ready, contextQ.data, existing, businessId]);

  const industry =
    contextQ.data?.businesses.find((b) => b.id === business)?.industry ?? null;

  const mutation = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          businessId: business === UNSET ? null : business,
          email,
          countryCode: country || null,
          productKeys: products,
          expectedQuantity: quantity === UNSET ? null : quantity,
          preferredSize: size === UNSET ? null : size,
          preferredMaterial: material === UNSET ? null : material,
          desiredTimeframe: timeframe === UNSET ? null : timeframe,
          comments: comments || null,
          contactConsent: consent,
          source,
        },
      }),
    onSuccess: (result) => {
      track(result.updated ? "print_preferences_updated" : "print_interest_submitted", {
        source,
        products: products.length,
        top_product: products[0] ?? null,
        industry,
        country: country || null,
        consent,
      });
      qc.invalidateQueries({ queryKey: ["print-interest-context"] });
      setDone(true);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save your preferences."),
  });

  const toggleProduct = (key: string) =>
    setProducts((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden />
                Thanks — you&rsquo;re on the print waitlist.
              </DialogTitle>
              <DialogDescription>
                We&rsquo;ll use your preferences to prioritise products and may contact you when
                printing becomes available in your region.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="outline" onClick={() => setDone(false)}>
                Update my preferences
              </Button>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Join the print waitlist</DialogTitle>
              <DialogDescription>
                Printing isn&rsquo;t available yet. Tell us what you need and we&rsquo;ll
                prioritise the most requested products.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Products of interest</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PRINT_INTEREST_PRODUCTS.map((p) => (
                    <label
                      key={p.key}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={products.includes(p.key)}
                        onCheckedChange={() => toggleProduct(p.key)}
                        aria-label={p.label}
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pw-business">Business</Label>
                  <Select value={business} onValueChange={setBusiness}>
                    <SelectTrigger id="pw-business">
                      <SelectValue placeholder="Select a business" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSET}>Not specific to one business</SelectItem>
                      {(contextQ.data?.businesses ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pw-country">Country</Label>
                  <Input
                    id="pw-country"
                    value={country}
                    maxLength={2}
                    placeholder="GB"
                    onChange={(e) => setCountry(e.target.value.toUpperCase())}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pw-quantity">Expected quantity</Label>
                  <Select value={quantity} onValueChange={setQuantity}>
                    <SelectTrigger id="pw-quantity">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSET}>No preference</SelectItem>
                      {PRINT_QUANTITY_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pw-size">Preferred size</Label>
                  <Select value={size} onValueChange={setSize}>
                    <SelectTrigger id="pw-size">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSET}>No preference</SelectItem>
                      {PRINT_SIZE_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pw-material">Preferred material</Label>
                  <Select value={material} onValueChange={setMaterial}>
                    <SelectTrigger id="pw-material">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSET}>No preference</SelectItem>
                      {PRINT_MATERIAL_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pw-timeframe">Desired timeframe</Label>
                  <Select value={timeframe} onValueChange={setTimeframe}>
                    <SelectTrigger id="pw-timeframe">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSET}>No preference</SelectItem>
                      {PRINT_TIMEFRAME_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pw-comments">Anything else? (optional)</Label>
                <Textarea
                  id="pw-comments"
                  value={comments}
                  maxLength={2000}
                  rows={3}
                  placeholder="Sizes, finishes, quantities per site, delivery constraints…"
                  onChange={(e) => setComments(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pw-email">Contact email</Label>
                <Input
                  id="pw-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <label className="flex items-start gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                  aria-label="Permission to contact"
                />
                <span>
                  You may contact me about printed products for my business. No launch date is
                  promised and nothing is ordered or charged.
                </span>
              </label>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || products.length === 0 || !email}
              >
                {existing ? "Update my preferences" : "Join the print waitlist"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
