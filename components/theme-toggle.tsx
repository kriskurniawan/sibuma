"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { value: "light", label: "Terang", icon: Sun },
  { value: "dark", label: "Gelap", icon: Moon },
  { value: "system", label: "Sistem", icon: Monitor },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <Tabs
      value={mounted ? (theme ?? null) : null}
      onValueChange={(value) => {
        if (value) setTheme(String(value));
      }}
      className={cn("w-full lg:w-fit", className)}
    >
      <TabsList aria-label="Pilih tema tampilan" className="w-full lg:w-fit">
        {THEME_OPTIONS.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className="flex-1 lg:flex-none"
          >
            <option.icon aria-hidden="true" />
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
