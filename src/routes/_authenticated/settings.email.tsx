import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  loadEmailDeliveries,
  loadEmailSettings,
  saveEmailPreferences,
  sendTestEmail,
  type EmailPreferencesRow,
} from "@/lib/email-preferences.functions";
import { WEEKDAYS, formatLocalTime } from "@/lib/email-schedule";
import { EMAIL_PAYWALL_COPY } from "@/lib/email-entitlements";

export const Route = createFileRoute("/_authenticated/settings/email")({
  head: () => ({
    meta: [
      { title: "Email preferences | GuestReview Pro" },
      {
        name: "description",
        content:
          "Choose when your weekly Reputation Health report arrives, which businesses it covers and which other emails you receive.",
      },
      { property: "og:title", content: "Email preferences | GuestReview Pro" },
      {
        property: "og:description",
        content: "Control your weekly report delivery day, time, timezone and businesses.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmailSettingsPage,
});

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => formatLocalTime(i * 30));

function EmailSettingsPage() {
  const load = useServerFn(loadEmailSettings);
  const loadHistory = useServerFn(loadEmailDeliveries);
  const save = useServerFn(saveEmailPreferences);
  const testSend = useServerFn(sendTestEmail);
  const queryClient = useQueryClient();

  const settings = useQuery({ queryKey: ["email-settings"], queryFn: () => load() });
  const history = useQuery({
    queryKey: ["email-deliveries"],
    queryFn: () => loadHistory(),
    enabled: Boolean(settings.data?.entitlements.deliveryHistory),
  });

  const [form, setForm] = useState<EmailPreferencesRow | null>(null);
  useEffect(() => {
    if (settings.data) setForm(settings.data.preferences);
  }, [settings.data]);

  const ent = settings.data?.entitlements;
  const businesses = settings.data?.businesses ?? [];
  const maxBusinesses = ent?.weeklyReportBusinessesMax ?? 0;

  const mutation = useMutation({
    mutationFn: (input: EmailPreferencesRow) =>
      save({
        data: {
          weeklyReportEnabled: input.weeklyReportEnabled,
          weekday: input.weekday,
          localTime: input.localTime,
          timezone: input.timezone,
          businessIds: input.businessIds,
          productUpdatesEnabled: input.productUpdatesEnabled,
          portfolioDigestEnabled: input.portfolioDigestEnabled,
          portfolioWeekday: input.portfolioWeekday,
          portfolioLocalTime: input.portfolioLocalTime,
          portfolioBusinessIds: input.portfolioBusinessIds,
          reportFormat: input.reportFormat,
        },
      }),
    onSuccess: (result) => {
      setForm(result.preferences);
      toast.success("Email preferences saved");
      void queryClient.invalidateQueries({ queryKey: ["email-settings"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not save your preferences."),
  });

  const test = useMutation({
    mutationFn: (template: "weekly_reputation_health" | "portfolio_digest") =>
      testSend({ data: { template } }),
    onSuccess: (result) => {
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      void queryClient.invalidateQueries({ queryKey: ["email-deliveries"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not send the test email."),
  });

  const selectedCount = form?.businessIds.length ?? 0;
  const canAddMore = useMemo(() => selectedCount < maxBusinesses, [selectedCount, maxBusinesses]);

  function update(patch: Partial<EmailPreferencesRow>) {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function toggleBusiness(id: string, checked: boolean) {
    setForm((prev) => {
      if (!prev) return prev;
      if (checked) {
        if (prev.businessIds.includes(id)) return prev;
        if (prev.businessIds.length >= maxBusinesses) return prev;
        return { ...prev, businessIds: [...prev.businessIds, id] };
      }
      return { ...prev, businessIds: prev.businessIds.filter((b) => b !== id) };
    });
  }

  return (
    <div className="animate-fade-in-up space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Email preferences</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Choose when your weekly Reputation Health™ report arrives and which other emails you
          receive. Billing and security emails are always sent — they keep your account safe and
          your subscription working.
        </p>
      </header>

      {settings.isLoading || !form ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-sm">
            Loading your preferences…
          </CardContent>
        </Card>
      ) : (
        <>
          {settings.data && settings.data.domainStatus !== "active" ? (
            <Card className="border-primary/40">
              <CardContent className="py-4 text-sm">
                <strong>Delivery is warming up.</strong>{" "}
                {settings.data.domainMessage ?? "Email delivery is waiting for DNS verification."}{" "}
                Your preferences are saved and reports start arriving as soon as the sending domain
                is verified.
              </CardContent>
            </Card>
          ) : null}

          {settings.data?.suppressed ? (
            <Card className="border-destructive/40">
              <CardContent className="py-4 text-sm">
                <strong>Delivery paused.</strong> Your address was suppressed after a bounce or
                complaint, so weekly reports and product updates are not being sent. Contact support
                to restore delivery.
              </CardContent>
            </Card>
          ) : null}

          {!ent?.weeklyReport ? (
            <Card className="border-primary/40">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
                <p className="text-sm">{EMAIL_PAYWALL_COPY}</p>
                <Button asChild size="sm">
                  <Link to="/plans">View plans</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg">Weekly Reputation Health™ report</CardTitle>
              <Switch
                checked={form.weeklyReportEnabled && Boolean(ent?.weeklyReport)}
                disabled={!ent?.weeklyReport}
                onCheckedChange={(v) => update({ weeklyReportEnabled: v })}
                aria-label="Weekly report enabled"
              />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="weekday">Delivery day</Label>
                  <Select
                    value={String(form.weekday)}
                    onValueChange={(v) => update({ weekday: Number(v) })}
                  >
                    <SelectTrigger id="weekday">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="local-time">Local delivery time</Label>
                  <Select value={form.localTime} onValueChange={(v) => update({ localTime: v })}>
                    <SelectTrigger id="local-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={form.timezone} onValueChange={(v) => update({ timezone: v })}>
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {(settings.data?.timezones ?? []).map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Businesses included</Label>
                  <span className="text-muted-foreground text-xs">
                    {selectedCount}/{maxBusinesses} allowed on your plan
                  </span>
                </div>
                {businesses.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Add a business first and it will appear here.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {businesses.map((b) => {
                      const checked = form.businessIds.includes(b.id);
                      return (
                        <label
                          key={b.id}
                          className="border-border/60 flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            disabled={!ent?.weeklyReport || (!checked && !canAddMore)}
                            onCheckedChange={(v) => toggleBusiness(b.id, v === true)}
                          />
                          <span className="truncate">{b.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="report-format">Report format</Label>
                  <Select
                    value={form.reportFormat}
                    onValueChange={(v) =>
                      update({ reportFormat: v === "summary" ? "summary" : "full" })
                    }
                  >
                    <SelectTrigger id="report-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full report</SelectItem>
                      <SelectItem value="summary">Short summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <label className="border-border/60 flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                    <span>
                      Portfolio digest
                      {!ent?.portfolioDigest ? (
                        <Badge variant="secondary" className="ml-2">
                          Business plan
                        </Badge>
                      ) : null}
                    </span>
                    <Switch
                      checked={form.portfolioDigestEnabled && Boolean(ent?.portfolioDigest)}
                      disabled={!ent?.portfolioDigest}
                      onCheckedChange={(v) => update({ portfolioDigestEnabled: v })}
                      aria-label="Portfolio digest"
                    />
                  </label>
                </div>
              </div>

              {ent?.portfolioDigest ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="portfolio-weekday">Digest day</Label>
                    <Select
                      value={String(form.portfolioWeekday)}
                      onValueChange={(v) => update({ portfolioWeekday: Number(v) })}
                    >
                      <SelectTrigger id="portfolio-weekday">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((d) => (
                          <SelectItem key={d.value} value={String(d.value)}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="portfolio-time">Digest time</Label>
                    <Select
                      value={form.portfolioLocalTime}
                      onValueChange={(v) => update({ portfolioLocalTime: v })}
                    >
                      <SelectTrigger id="portfolio-time">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}

              {ent?.preview ? (
                <div className="border-border/60 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3 text-sm">
                  <span>
                    <span className="block font-medium">Send yourself a test</span>
                    <span className="text-muted-foreground">
                      Goes only to your own address, using your real data.
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={test.isPending}
                      onClick={() => test.mutate("weekly_reputation_health")}
                    >
                      Test weekly report
                    </Button>
                    {ent.portfolioDigest ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={test.isPending}
                        onClick={() => test.mutate("portfolio_digest")}
                      >
                        Test digest
                      </Button>
                    ) : null}
                  </span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Other emails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="border-border/60 flex items-center justify-between gap-4 rounded-lg border px-3 py-3 text-sm">
                <span>
                  <span className="block font-medium">Product updates</span>
                  <span className="text-muted-foreground">
                    Occasional news about new features. Separate from your weekly report — turning
                    this on is explicit marketing consent.
                  </span>
                </span>
                <Switch
                  checked={form.productUpdatesEnabled}
                  onCheckedChange={(v) => update({ productUpdatesEnabled: v })}
                  aria-label="Product updates"
                />
              </label>

              <div className="border-border/60 text-muted-foreground flex items-center justify-between gap-4 rounded-lg border px-3 py-3 text-sm">
                <span>
                  <span className="text-foreground block font-medium">Billing emails</span>
                  Receipts, failed payments and subscription changes.
                </span>
                <Badge variant="secondary">Always on</Badge>
              </div>

              <div className="border-border/60 text-muted-foreground flex items-center justify-between gap-4 rounded-lg border px-3 py-3 text-sm">
                <span>
                  <span className="text-foreground block font-medium">Security emails</span>
                  Password resets and address verification.
                </span>
                <Badge variant="secondary">Always on</Badge>
              </div>

              <div className="border-border/60 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3 text-sm">
                <span>
                  <span className="block font-medium">Your email address</span>
                  <span className="text-muted-foreground">{settings.data?.email ?? "—"}</span>
                </span>
                <Badge variant={settings.data?.emailConfirmed ? "secondary" : "destructive"}>
                  {settings.data?.emailConfirmed ? "Confirmed" : "Not confirmed"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => form && mutation.mutate(form)} disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save preferences"}
            </Button>
          </div>

          {ent?.deliveryHistory ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent deliveries</CardTitle>
              </CardHeader>
              <CardContent>
                {history.isLoading ? (
                  <p className="text-muted-foreground text-sm">Loading…</p>
                ) : (history.data ?? []).length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nothing sent yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(history.data ?? []).map((row) => (
                      <div
                        key={row.id}
                        className="border-border/60 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{row.subject}</span>
                          <span className="text-muted-foreground text-xs">
                            {row.recipient} · {new Date(row.createdAt).toLocaleString()}
                          </span>
                        </span>
                        <Badge variant={row.status === "failed" ? "destructive" : "secondary"}>
                          {row.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
