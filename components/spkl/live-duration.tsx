"use client";

import { useEffect, useState } from "react";
import { durationClock } from "@/lib/time";
import { cn } from "@/lib/utils";

export function LiveDuration({
  startAt,
  endAt,
  mode = "elapsed",
  className,
}: {
  startAt: string;
  endAt: string;
  mode?: "elapsed" | "remaining" | "countdown";
  className?: string;
}) {
  // Live clock: intentionally read on the client; suppressHydrationWarning
  // covers the one-second gap between the server render and hydration.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const seconds =
    mode === "elapsed"
      ? Math.floor((Math.min(now, end) - start) / 1000)
      : mode === "remaining"
        ? Math.floor((end - Math.max(now, start)) / 1000)
        : Math.floor((end - now) / 1000);

  return (
    <span
      className={cn("tnum tabular-nums", className)}
      suppressHydrationWarning
    >
      {durationClock(Math.max(0, seconds))}
    </span>
  );
}
