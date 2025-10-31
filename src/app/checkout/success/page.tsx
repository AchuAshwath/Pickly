import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CheckoutSuccessPage() {
  return (
    <div className="container mx-auto p-6 md:p-10 space-y-6 text-center">
      <h1 className="text-3xl font-bold">Thank you for your support</h1>
      <p className="text-muted-foreground max-w-xl mx-auto">
        Your tip helps keep the project fast, polished, and local‑first. I appreciate it.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button asChild>
          <Link href="/gallery">Open Gallery</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  )
}


