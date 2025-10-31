"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";

export default function HomePage() {
  return (
    <div className="container mx-auto p-6 md:p-10 space-y-10">
      <section className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Pickly</h1>
        <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
          A fast, privacy‑first photo culling tool that runs 100% in your browser.
          Load from a local folder, highlight, rate, flag, compare, and copy your selections — no uploads.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button asChild>
            <Link href="/gallery">Open Gallery</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/donate">Support</Link>
          </Button>
        </div>
      </section>

      <Separator />

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 bg-muted/20">
          <CardHeader>
            <CardTitle>Pick a folder, get to work</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>Sticky toolbar with recent folders, a formatted copyable selection list, and quick actions.</p>
            <div className="relative aspect-video w-full rounded-md overflow-hidden">
              <Image src="/choose folder.png" alt="Choose folder UI" fill className="object-cover" style={{ objectPosition: 'center 9px' }} priority />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/20">
          <CardHeader>
            <CardTitle>Highlight, rate, and flag</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>Click to highlight, tick to select. Apply ratings 0–5 and pick/reject to highlighted photos.</p>
            <div className="relative aspect-video w-full rounded-md overflow-hidden">
              <Image src="/rating and pick.png" alt="Rating and pick UI" fill className="object-cover" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/20">
          <CardHeader>
            <CardTitle>Compare and copy list</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>Compare two photos side‑by‑side and copy a clean, numbered selection list.</p>
            <div className="relative aspect-video w-full rounded-md overflow-hidden">
              <Image src="/copy list.png" alt="Copy selection list" fill className="object-cover object-top" />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Built for speed and privacy</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 bg-muted/20">
            <CardHeader>
              <CardTitle>Local‑first</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>Files never leave your machine. Everything runs in your browser.</p>
              <div className="relative aspect-[4/3] w-full rounded-md overflow-hidden">
                <Image src="/local.png" alt="Local-first" fill className="object-cover" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 bg-muted/20">
            <CardHeader>
              <CardTitle>Clean viewer</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>Calm thumbnails, fullscreen viewer with zoom/pan, and EXIF/size stats on demand.</p>
              <div className="relative aspect-[4/3] w-full rounded-md overflow-hidden">
                <Image src="/clean UI.png" alt="Clean viewer" fill className="object-cover" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 bg-muted/20">
            <CardHeader>
              <CardTitle>Shortcuts and filters</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>Keyboard shortcuts for quick rating/flagging and simple filters to focus on the best shots.</p>
              <div className="relative aspect-[4/3] w-full rounded-md overflow-hidden">
                <Image src="/filters.png" alt="Shortcuts and filters" fill className="object-cover" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-2xl font-semibold">Roadmap</h2>
        <Card className="border-0 bg-muted/10">
          <CardContent className="p-0">
            <div className="p-3 md:p-4">
              <ol className="relative border-l pl-3 space-y-2">
                <li className="relative">
                  <span className="absolute -left-[8px] top-1 size-[6px] rounded-full bg-primary" />
                  <div className="text-sm">
                    <div className="font-medium leading-tight">Duplicate grouping</div>
                    <p className="text-muted-foreground mt-0.5 leading-snug">Quick de‑dup workflow to collapse and resolve look‑alikes.</p>
                  </div>
                </li>
                <li className="relative">
                  <span className="absolute -left-[8px] top-1 size-[6px] rounded-full bg-primary" />
                  <div className="text-sm">
                    <div className="font-medium leading-tight">Advanced sorting</div>
                    <p className="text-muted-foreground mt-0.5 leading-snug">Sort by size, date, dimensions, or type to surface keepers.</p>
                  </div>
                </li>
                <li className="relative">
                  <span className="absolute -left-[8px] top-1 size-[6px] rounded-full bg-primary" />
                  <div className="text-sm">
                    <div className="font-medium leading-tight">Histogram & exposure aids</div>
                    <p className="text-muted-foreground mt-0.5 leading-snug">At‑a‑glance exposure hints right in the viewer.</p>
                  </div>
                </li>
                <li className="relative">
                  <span className="absolute -left-[8px] top-1 size-[6px] rounded-full bg-primary" />
                  <div className="text-sm">
                    <div className="font-medium leading-tight">Refined compare</div>
                    <p className="text-muted-foreground mt-0.5 leading-snug">Synced zoom/pan and faster swapping between two shots.</p>
                  </div>
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-2xl font-semibold">Support</h2>
        <div className="relative overflow-hidden rounded-xl border-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent p-[1px]">
          <div className="rounded-xl bg-background p-4 md:p-5">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="max-w-xl">
                <div className="text-xs uppercase tracking-wider text-primary/80">Support</div>
                <h3 className="text-lg font-semibold mt-0.5">Like the app?</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Local‑first and free. If it saves you time, a small tip helps keep it fast and polished.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="h-8 px-3" asChild>
                  <Link href="/donate?amt=5">Tip $5</Link>
                </Button>
                <Button variant="outline" className="h-8 px-3" asChild>
                  <Link href="/donate?amt=10">Tip $10</Link>
                </Button>
                <Button className="h-8 px-4" asChild>
                  <Link href="/donate">Support Pickly</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
