"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";

export function ThemeToaster() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const theme: "light" | "dark" | "system" =
    mounted && resolvedTheme === "dark"
      ? "dark"
      : mounted && resolvedTheme === "light"
        ? "light"
        : "system";

  return (
    <Toaster
      position="top-center"
      closeButton
      richColors
      theme={theme}
      toastOptions={{
        classNames: {
          toast: "font-sans",
        },
      }}
    />
  );
}
