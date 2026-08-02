// Compact history of previously generated weekly summaries.
// Older generations are preserved — nothing is overwritten.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, Eye, Trash2 } from "lucide-react";
import { deleteWeeklyInsight, type StoredInsight } from "@/lib/ai-insights.functions";
import { insightToPlainText } from "@/lib/ai-insights";
import { toHistoryRows } from "@/lib/ai-insight-view";

export function InsightHistoryPanel({
  insights,
  businessId,
  businessName,
  activeId,
  onOpen,
}: {
  insights: StoredInsight[];
  businessId: string | null;
  businessName: string;
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const remove = useServerFn(deleteWeeklyInsight);

  const del = useMutation({
    mutationFn: async (id: string) => await remove({ data: { insightId: id } }),
    onSuccess: async () => {
      toast.success("Summary deleted");
      await queryClient.invalidateQueries({ queryKey: ["insight-list", businessId] });
      await queryClient.invalidateQueries({ queryKey: ["insight-access", businessId] });
    },
    onError: () => toast.error("We couldn't delete that just now. Please try again."),
  });

  if (insights.length <= 1) return null;
  const rows = toHistoryRows(insights);

  function textFor(id: string): string | null {
    const found = insights.find((i) => i.id === id);
    return found?.output ? insightToPlainText(found.output, businessName) : null;
  }

  async function copy(id: string) {
    const text = textFor(id);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Summary copied");
    } catch {
      toast.error("Your browser blocked copying. Select the text and copy it manually.");
    }
  }

  function download(id: string) {
    const text = textFor(id);
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${businessName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-weekly-summary.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-2 print:hidden" aria-label="Previous weekly summaries">
      <p className="text-sm font-semibold">Previous summaries</p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-start justify-between gap-2 rounded-2xl border border-border/60 p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium">{r.headline}</p>
                {r.id === activeId && <Badge variant="secondary">Showing</Badge>}
                <Badge variant="outline">{r.statusLabel}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {r.generated} · {r.period} · Score {r.score ?? "—"} · {r.movement}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                disabled={!r.canOpen}
                aria-label={`Open summary from ${r.generated}`}
                onClick={() => onOpen(r.id)}
              >
                <Eye className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                disabled={!r.canOpen}
                aria-label={`Copy summary from ${r.generated}`}
                onClick={() => copy(r.id)}
              >
                <Copy className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                disabled={!r.canOpen}
                aria-label={`Download summary from ${r.generated}`}
                onClick={() => download(r.id)}
              >
                <Download className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-xl"
                disabled={del.isPending}
                aria-label={`Delete summary from ${r.generated}`}
                onClick={() => del.mutate(r.id)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
