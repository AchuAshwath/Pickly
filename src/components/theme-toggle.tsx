"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = (resolvedTheme ?? "system") === "dark"

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      className="flex items-center gap-1"
    >
      {mounted ? (
        isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
      ) : (
        // Render a stable placeholder to avoid SSR/CSR mismatch
        <span className="inline-block h-4 w-4" />
      )}
      <span className="hidden sm:inline">{mounted ? (isDark ? "Light" : "Dark") : "Theme"}</span>
    </Button>
  )
}


