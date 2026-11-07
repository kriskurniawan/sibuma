import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("h-8 w-8", className)}
    >
      {/* Fixed brand artwork, shared with the favicon and installed app icons. */}
      <rect width="64" height="64" rx="18" fill="#623BBD" />
      <path
        d="M18 21.5a3 3 0 0 1 1.8-2.75l13-5.67A3 3 0 0 1 37 15.83V49H18V21.5Z"
        fill="#FFFFFF"
      />
      <path
        d="M40 29.5a2 2 0 0 1 1.17-1.82l5-2.27A2 2 0 0 1 49 27.23V49h-9V29.5Z"
        fill="#D8C6FF"
      />
      <path
        d="M15 49h37"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M24 26h7M24 33h7M24 40h7"
        stroke="#623BBD"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({
  variant = "dark",
  compact = false,
  className,
}: {
  variant?: "dark" | "light";
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={compact ? "h-7 w-7" : "h-8 w-8"} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-bold tracking-[0.04em]",
            compact ? "text-lg" : "text-xl",
            variant === "light" ? "text-primary-foreground" : "text-foreground",
          )}
        >
          SIBUMA
        </span>
        {!compact && (
          <span
            className={cn(
              "mt-1 text-xs font-medium tracking-[0.02em]",
              variant === "light"
                ? "text-primary-foreground/60"
                : "text-muted-foreground",
            )}
          >
            Sistem Building Management
          </span>
        )}
      </span>
    </span>
  );
}
