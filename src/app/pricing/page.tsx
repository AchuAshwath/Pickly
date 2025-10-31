"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PricingPage() {
  return (
    <div className="container mx-auto p-6 md:p-10 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Pricing</h1>
        <p className="text-muted-foreground">Simple plans. Everything runs locally. Test-mode checkout later.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc list-inside space-y-1">
              <li>Local folder browsing</li>
              <li>Selection and copy list</li>
              <li>Lightbox with zoom</li>
              <li>Nerd stats overlay</li>
            </ul>
            <Button className="w-full" asChild>
              <Link href="/gallery">Get Started</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pro (Sandbox)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc list-inside space-y-1">
              <li>Ratings/flags + filters</li>
              <li>EXIF panel</li>
              <li>Compare mode</li>
              <li>Duplicate grouping</li>
            </ul>
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                const res = await fetch('/api/checkout', { method: 'POST' })
                const data = await res.json()
                if (data?.url) {
                  window.location.href = data.url as string
                }
              }}
            >
              Buy Pro (Test $9)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


