import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
    >
      <rect width="32" height="32" rx="10" fill="#623BBD" />
      <path
        d="M9 9.5V19a3.5 3.5 0 0 0 3.5 3.5H23"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="22.5" cy="9.5" r="3" fill="#D8C6FF" />
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
