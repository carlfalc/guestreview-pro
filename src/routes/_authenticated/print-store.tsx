import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Globe2, Package, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PrintWaitlistDialog } from "@/components/print/PrintWaitlistDialog";
import { useTrackOnce } from "@/hooks/use-analytics";

export const Route = createFileRoute("/_authenticated/print-store")({
  component: PrintStoreComingSoon,
  head: () => ({
    meta: [
      { title: "Professional printing — GuestReview Pro" },
      {
        name: "description",
        content:
          "Professionally printed QR stickers, counter cards, table tents and posters are coming soon. Join the GuestReview Pro print waitlist.",
      },
      { property: "og:title", content: "Professional printing — GuestReview Pro" },
      {
        property: "og:description",
        content:
          "Professionally printed QR stickers, counter cards, table tents and posters are coming soon.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const CATEGORIES = [
  {
    title: "Stickers & decals",
    body: "Weatherproof vinyl QR stickers and window decals for doors, counters and pumps.",
  },
  {
    title: "Counter cards & table tents",
    body: "Rigid folded tents and counter cards sized for real hospitality tables.",
  },
  {
    title: "Posters",
    body: "A4 and A5 posters for waiting areas, corridors and back-of-house boards.",
  },
  {
    title: "Hotel & rooms",
    body: "Room cards and reception signage matched to your brand colours.",
  },
  {
    title: "Starter packs",
    body: "Industry packs for restaurants, hotels, cafés and retail in one shipment.",
  },
];

const FAQ = [
  {
    q: "Can I order printing today?",
    a: "Not yet. We're validating which products and regions to launch first. Joining the waitlist costs nothing and orders nothing.",
  },
  {
    q: "Will my existing designs be used?",
    a: "Yes. Printing will use the same marketing pack formats, QR codes and brand settings you already have in your account.",
  },
  {
    q: "How will I know the artwork is correct?",
    a: "Every item will go through the same validation engine used for exports, plus a proof you approve before anything is produced.",
  },
  {
    q: "When will printing launch?",
    a: "There's no launch date yet. We prioritise products and regions by real demand, which is exactly what the waitlist measures.",
  },
  {
    q: "What happens to my preferences?",
    a: "They're stored against your account, visible only to you and our team, and you can update them at any time.",
  },
];

function PrintStoreComingSoon() {
  const [open, setOpen] = useState(false);
  useTrackOnce("print_coming_soon_viewed", { source: "print_store" });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8">
      <header className="space-y-3">
        <Badge variant="secondary">Coming soon</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">
          Professional printing for your QR materials
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Print-ready stickers, counter cards, table tents, posters and hospitality packs, produced
          from the designs already in your account. We&rsquo;re preparing this now — tell us what
          you need and we&rsquo;ll prioritise the most requested products and regions.
        </p>
        <div>
          <Button size="lg" onClick={() => setOpen(true)}>
            Join the print waitlist
          </Button>
        </div>
      </header>

      <section aria-labelledby="print-categories" className="space-y-3">
        <h2 id="print-categories" className="text-xl font-semibold">
          Product categories we&rsquo;re preparing
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <Card key={c.title}>
              <CardContent className="space-y-1.5 p-5">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" aria-hidden />
                  <h3 className="font-medium">{c.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{c.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Pricing is not yet available and nothing on this page can be purchased.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="font-medium">Proof checking</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Every item runs through the same validation engine as your exports: QR quiet zone and
              minimum size, contrast, bleed and safe area, plus a decode test. You then approve a
              visual proof before anything is produced — no surprises off the press.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="font-medium">Regional fulfilment</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Printing will be produced as close to you as we can, so delivery is faster and
              greener. Which regions launch first depends on where demand is strongest — your
              country on the waitlist directly influences that.
            </p>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="print-waitlist" className="space-y-3">
        <h2 id="print-waitlist" className="text-xl font-semibold">
          Tell us what you need
        </h2>
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> Takes under a minute
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> Nothing is ordered or
                charged
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> Update your
                preferences whenever you like
              </li>
            </ul>
            <Button onClick={() => setOpen(true)}>Join the print waitlist</Button>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="print-faq" className="space-y-3">
        <h2 id="print-faq" className="text-xl font-semibold">
          Questions
        </h2>
        <Accordion type="single" collapsible className="rounded-lg border border-border/60 px-4">
          {FAQ.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left text-sm">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <PrintWaitlistDialog open={open} onOpenChange={setOpen} source="print_store" />
    </div>
  );
}
