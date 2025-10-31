"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DonatePage() {
  return (
    <div className="container mx-auto p-6 md:p-10 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Support Pickly</h1>
        <p className="text-muted-foreground">If this tool helps your workflow, you can chip in to keep it going.</p>
      </div>

      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Thanks for being here</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>No accounts, no sign‑ups—just a tip if you’d like.</p>
            <Button
              className="w-full"
              variant="outline"
              onClick={async () => {
                const res = await fetch('/api/checkout', { method: 'POST' });
                const data = await res.json();
                if (data?.url) window.location.href = data.url as string;
              }}
            >
              Support with a tip
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


