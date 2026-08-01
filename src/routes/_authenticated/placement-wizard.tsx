import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import {
  BUSINESS_GOALS,
  INDUSTRIES,
  blueprintsForIndustry,
  defaultPlanName,
  destinationForGoal,
  formatById,
  industryLabel,
  matchIndustry,
  placementsForIndustry,
  recommendPlacements,
  type GoalKey,
  type IndustryKey,
  type PlacementRecommendation,
  type PriorityKey,
} from "@/lib/placement-recommendations";
import { DESTINATION_TYPES } from "@/lib/qr-destinations";
import { FORMATS } from "@/lib/qr-formats";
import { savePlacementPlan, generatePlacementPlan } from "@/lib/placement-plans.functions";
import { useBilling } from "@/hooks/use-billing";
import { friendlyMutationError } from "@/lib/plan-errors";
import { useTrack } from "@/hooks/use-analytics";

export const Route = createFileRoute("/_authenticated/placement-wizard")({
  component: PlacementWizard,
});

type Draft = PlacementRecommendation;

const STEPS = ["Business", "Goals", "Customer journey", "Your plan"];

function PlacementWizard() {
  const navigate = useNavigate();
  const track = useTrack();
  const { plan: tier, isPaid } = useBilling();
  const save = useServerFn(savePlacementPlan);
  const generate = useServerFn(generatePlacementPlan);

  const [step, setStep] = useState(1);
  const [businessId, setBusinessId] = useState("");
  const [industry, setIndustry] = useState<IndustryKey>("restaurant");
  const [goals, setGoals] = useState<GoalKey[]>(["reviews"]);
  const [selected, setSelected] = useState<string[]>([]);
  const [customName, setCustomName] = useState("");
  const [customPlacements, setCustomPlacements] = useState<Array<{ key: string; name: string }>>(
    [],
  );
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [planName, setPlanName] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paywall, setPaywall] = useState(false);

  const { data: businesses } = useQuery({
    queryKey: ["wizard-businesses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, industry, google_review_url, logo_url")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const business = useMemo(
    () => businesses?.find((b) => b.id === businessId) ?? null,
    [businesses, businessId],
  );

  const { data: existingKeys } = useQuery({
    queryKey: ["wizard-existing-placements", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qr_codes")
        .select("placement_key")
        .eq("business_id", businessId)
        .eq("status", "active");
      if (error) throw error;
      return (data ?? [])
        .map((r) => (r as { placement_key: string | null }).placement_key)
        .filter(Boolean) as string[];
    },
  });

  const journeyOptions = useMemo(() => placementsForIndustry(industry), [industry]);
  const blueprints = useMemo(() => blueprintsForIndustry(industry), [industry]);

  function chooseBusiness(id: string) {
    setBusinessId(id);
    const b = businesses?.find((x) => x.id === id);
    const matched = matchIndustry(b?.industry ?? null);
    if (matched) setIndustry(matched);
    setSelected([]);
    setDrafts(null);
  }

  function toggleGoal(key: GoalKey) {
    setGoals((prev) =>
      prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key].slice(0, 4),
    );
    setDrafts(null);
  }

  function togglePlacement(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setDrafts(null);
  }

  function applyBlueprint(keys: string[], blueprintGoals: GoalKey[]) {
    setGoals(blueprintGoals);
    setSelected(keys);
    setDrafts(null);
    setStep(3);
  }

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    const key = `custom_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}`;
    if (customPlacements.some((c) => c.key === key)) return setCustomName("");
    setCustomPlacements((p) => [...p, { key, name }]);
    setSelected((p) => [...p, key]);
    setCustomName("");
    setDrafts(null);
  }

  function buildPlan() {
    const recs = recommendPlacements({
      industry,
      goals,
      placementKeys: selected,
      customPlacements,
      existingPlacementKeys: existingKeys ?? [],
    });
    setDrafts(recs);
    if (!planName) setPlanName(defaultPlanName(business?.name ?? "", goals));
    setStep(4);
  }

  function next() {
    if (step === 1) {
      if (!businessId) return toast.error("Choose a business to plan for");
      return setStep(2);
    }
    if (step === 2) {
      if (!goals.length) return toast.error("Choose at least one goal");
      return setStep(3);
    }
    if (step === 3) {
      if (!selected.length && !customPlacements.length) {
        return toast.error("Choose at least one place customers interact with you");
      }
      return buildPlan();
    }
  }

  function patchDraft(key: string, patch: Partial<Draft>) {
    setDrafts((prev) =>
      (prev ?? []).map((d) => (d.placementKey === key ? { ...d, ...patch } : d)),
    );
  }

  function removeDraft(key: string) {
    setDrafts((prev) => (prev ?? []).filter((d) => d.placementKey !== key));
    setSelected((prev) => prev.filter((k) => k !== key));
  }

  async function persist(): Promise<string | null> {
    if (!business || !drafts?.length) return null;
    const result = await save({
      data: {
        businessId: business.id,
        name: planName.trim() || defaultPlanName(business.name, goals),
        industry,
        goals,
        items: drafts.map((d) => ({
          placementKey: d.placementKey,
          placementName: d.placementName,
          priority: d.priority,
          goal: d.goal,
          destinationType: d.destinationType,
          formatId: d.formatId,
          headline: d.headline,
          supportText: d.supportText,
          ctaText: d.ctaText,
          material: d.material,
        })),
      },
    });
    return result.id;
  }

  async function saveDraft() {
    setBusy(true);
    try {
      const id = await persist();
      if (!id) return;
      toast.success("Draft saved");
      navigate({ to: "/placement-plans/$id", params: { id } });
    } catch (e) {
      toast.error(friendlyMutationError(e, "Could not save the plan"));
    } finally {
      setBusy(false);
    }
  }

  async function generateAll() {
    if (!isPaid) return setPaywall(true);
    setBusy(true);
    try {
      const id = await persist();
      if (!id) return;
      const result = await generate({ data: { id } });
      track("qr_created", { source: "placement_wizard", count: result.generated });
      if (result.failures.length) {
        toast.warning(`${result.generated} created, ${result.failures.length} need attention`);
      } else {
        toast.success(`${result.generated} QR codes and a marketing pack created`);
      }
      navigate({ to: "/placement-plans/$id", params: { id } });
    } catch (e) {
      toast.error(friendlyMutationError(e, "Could not generate the plan"));
    } finally {
      setBusy(false);
    }
  }

  async function generateOneFree() {
    setBusy(true);
    setPaywall(false);
    try {
      const id = await persist();
      if (!id) return;
      const result = await generate({ data: { id } });
      if (result.generated) toast.success("Your first QR code is ready");
      else toast.error(result.failures[0]?.reason ?? "Could not generate the QR code");
      navigate({ to: "/placement-plans/$id", params: { id } });
    } catch (e) {
      toast.error(friendlyMutationError(e, "Could not generate the QR code"));
    } finally {
      setBusy(false);
    }
  }

  const packAssetCount = new Set((drafts ?? []).map((d) => d.formatId)).size;

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Placement Wizard</h1>
          <p className="text-sm text-muted-foreground">
            Answer three questions and we'll plan exactly where your QR codes should go.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/placement-plans">My plans</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {STEPS.map((label, i) => {
          const n = i + 1;
          return (
            <div
              key={label}
              className={`flex items-center gap-2 text-xs ${step >= n ? "text-foreground" : "text-muted-foreground"}`}
            >
              <div
                className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${step > n ? "bg-primary text-primary-foreground" : step === n ? "bg-primary/20 text-primary" : "bg-muted"}`}
              >
                {step > n ? <Check className="h-3 w-3" /> : n}
              </div>
              <span className="hidden sm:inline">{label}</span>
            </div>
          );
        })}
      </div>

      <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
        <CardContent className="space-y-6 p-6">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">What type of business do you run?</h2>
                <p className="text-sm text-muted-foreground">
                  Pick the business you're planning for, then confirm its type.
                </p>
              </div>

              {(businesses ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                  You don't have a business yet.{" "}
                  <Link to="/businesses" className="text-primary underline">
                    Create one
                  </Link>{" "}
                  to start planning.
                </div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {(businesses ?? []).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => chooseBusiness(b.id)}
                      className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${businessId === b.id ? "border-primary bg-primary/5" : "border-border/70 hover:bg-accent/40"}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{b.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {b.industry || "Industry not set"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Business type</Label>
                <Select value={industry} onValueChange={(v) => setIndustry(v as IndustryKey)}>
                  <SelectTrigger className="rounded-xl md:max-w-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((i) => (
                      <SelectItem key={i.key} value={i.key}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {blueprints.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-border/70 p-4">
                  <p className="text-sm font-medium">Start with a proven blueprint</p>
                  {blueprints.map((bp) => (
                    <div
                      key={bp.key}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span className="text-muted-foreground">{bp.description}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        disabled={!businessId}
                        onClick={() => applyBlueprint([...bp.placementKeys], [...bp.goals])}
                      >
                        <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Start with this blueprint
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">What are you trying to achieve?</h2>
                <p className="text-sm text-muted-foreground">
                  Choose one or more. We'll pick the right destinations and wording for you.
                </p>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {BUSINESS_GOALS.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => toggleGoal(g.key)}
                    className={`rounded-2xl border p-4 text-left transition-colors ${goals.includes(g.key) ? "border-primary bg-primary/5" : "border-border/70 hover:bg-accent/40"}`}
                  >
                    <p className="text-sm font-medium">{g.label}</p>
                    <p className="text-xs text-muted-foreground">{g.cta}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Where do customers interact with you?</h2>
                  <p className="text-sm text-muted-foreground">
                    Tick everything that applies to your {industryLabel(industry).toLowerCase()}.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setSelected(journeyOptions.slice(0, 6).map((p) => p.key))}
                >
                  Select all recommended
                </Button>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {journeyOptions.map((p) => (
                  <label
                    key={p.key}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${selected.includes(p.key) ? "border-primary bg-primary/5" : "border-border/70 hover:bg-accent/40"}`}
                  >
                    <Checkbox
                      checked={selected.includes(p.key)}
                      onCheckedChange={() => togglePlacement(p.key)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">{p.reason}</span>
                      {(existingKeys ?? []).includes(p.key) && (
                        <Badge variant="outline" className="mt-1.5">
                          Already has a QR code
                        </Badge>
                      )}
                    </span>
                  </label>
                ))}
              </div>

              {customPlacements.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {customPlacements.map((c) => (
                    <Badge key={c.key} variant="secondary">
                      {c.name}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1 space-y-1.5">
                  <Label>Add your own placement</Label>
                  <Input
                    className="rounded-xl"
                    value={customName}
                    placeholder="e.g. Delivery bag"
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </div>
                <Button variant="outline" className="rounded-xl" onClick={addCustom}>
                  <Plus className="mr-1.5 h-4 w-4" /> Add
                </Button>
              </div>
            </div>
          )}

          {step === 4 && drafts && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Your recommended placement plan</h2>
                <p className="text-sm text-muted-foreground">
                  Review and adjust anything before we create it. Everything stays editable
                  afterwards.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Business" value={business?.name ?? "—"} />
                <Stat label="Goals" value={goals.map((g) => g.replace("_", " ")).join(", ")} />
                <Stat label="QR codes" value={String(drafts.length)} />
                <Stat label="Marketing assets" value={String(packAssetCount)} />
              </div>

              <div className="space-y-1.5">
                <Label>Plan name</Label>
                <Input
                  className="rounded-xl md:max-w-md"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                {drafts.map((d, i) => (
                  <div key={d.placementKey} className="rounded-2xl border border-border/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">#{i + 1}</span>
                          <p className="text-sm font-medium">{d.placementName}</p>
                          <PriorityBadge priority={d.priority} />
                          {d.duplicateOfExisting && (
                            <Badge variant="outline">Existing QR — confirm before generating</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{d.reason}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {d.formatName} · {d.material} · QR at least {d.minQrSizeMm} mm ·{" "}
                          {d.ctaText}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl"
                          onClick={() =>
                            setExpanded(expanded === d.placementKey ? null : d.placementKey)
                          }
                        >
                          {expanded === d.placementKey ? "Done" : "Edit"}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeDraft(d.placementKey)}
                          title="Remove placement"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {expanded === d.placementKey && (
                      <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Destination</Label>
                          <Select
                            value={d.destinationType}
                            onValueChange={(v) =>
                              patchDraft(d.placementKey, {
                                destinationType: v as Draft["destinationType"],
                              })
                            }
                          >
                            <SelectTrigger className="rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DESTINATION_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Format</Label>
                          <Select
                            value={d.formatId}
                            onValueChange={(v) => {
                              const f = formatById(v);
                              patchDraft(d.placementKey, {
                                formatId: v,
                                formatName: f?.name ?? v,
                                material: f?.material ?? d.material,
                                minQrSizeMm: f?.minQrSize ?? d.minQrSizeMm,
                              });
                            }}
                          >
                            <SelectTrigger className="rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FORMATS.map((f) => (
                                <SelectItem key={f.id} value={f.id}>
                                  {f.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Priority</Label>
                          <Select
                            value={d.priority}
                            onValueChange={(v) =>
                              patchDraft(d.placementKey, { priority: v as PriorityKey })
                            }
                          >
                            <SelectTrigger className="rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Call to action</Label>
                          <Input
                            className="rounded-xl"
                            value={d.ctaText}
                            onChange={(e) =>
                              patchDraft(d.placementKey, { ctaText: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Headline</Label>
                          <Input
                            className="rounded-xl"
                            value={d.headline}
                            onChange={(e) =>
                              patchDraft(d.placementKey, { headline: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Support text</Label>
                          <Textarea
                            className="rounded-xl"
                            rows={2}
                            value={d.supportText}
                            onChange={(e) =>
                              patchDraft(d.placementKey, { supportText: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {!isPaid && (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
                  <p className="font-medium">Your free plan includes one QR code.</p>
                  <p className="text-muted-foreground">
                    Upgrade to Pro to generate the complete placement plan, unlimited QR codes and
                    matching marketing assets.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
            <Button
              variant="ghost"
              className="rounded-xl"
              disabled={step === 1 || busy}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
            </Button>
            {step < 4 ? (
              <Button className="rounded-xl" onClick={next}>
                Continue <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={busy || !drafts?.length}
                  onClick={saveDraft}
                >
                  Save draft
                </Button>
                <Button className="rounded-xl" disabled={busy || !drafts?.length} onClick={generateAll}>
                  {busy ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-4 w-4" />
                  )}
                  Generate All
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={paywall} onOpenChange={setPaywall}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your free plan includes one QR code.</DialogTitle>
            <DialogDescription>
              Upgrade to Pro to generate the complete placement plan, unlimited QR codes and
              matching marketing assets.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button asChild className="rounded-xl">
              <Link to="/plans">See Pro pricing for your region</Link>
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={generateOneFree} disabled={busy}>
              Generate my top placement only
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            You're on the {tier} plan. Nothing is created until you choose.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium capitalize">{value}</p>
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: PriorityKey }) {
  const variant = priority === "high" ? "default" : priority === "medium" ? "secondary" : "outline";
  return <Badge variant={variant}>{priority} priority</Badge>;
}

// Keeps the destination mapping referenced so it stays in the type graph.
export const _destinationForGoal = destinationForGoal;
