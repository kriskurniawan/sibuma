import Link from "next/link";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/reui/alert";
import { Badge as ReuiBadge } from "@/components/reui/badge";
import { IconTile } from "@/components/reui/icon-tile";
import { Avatar as ShadcnAvatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import {
  ATTENDANCE_STATUS_LABEL,
  SPKL_STATUS_LABEL,
} from "@/lib/constants";
import type { AttendanceStatus, Employee, SpklStatus } from "@/lib/types";
import { avatarColor, cn, initials } from "@/lib/utils";

// ── Avatar ──────────────────────────────────────────────────────────────────

const AVATAR_SIZES = {
  xs: "sm",
  sm: "sm",
  md: "default",
  lg: "lg",
  xl: "lg",
} as const;

export function Avatar({
  name,
  seed,
  size = "md",
  className,
  ring = false,
}: {
  name: string;
  seed?: string;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
  ring?: boolean;
}) {
  return (
    <ShadcnAvatar
      size={AVATAR_SIZES[size]}
      title={name}
      className={cn(ring && "ring-2 ring-card", className)}
    >
      <AvatarFallback
        className={cn("font-semibold", avatarColor(seed ?? name))}
      >
        {initials(name)}
      </AvatarFallback>
    </ShadcnAvatar>
  );
}

export function AvatarStack({
  employees,
  max = 4,
  size = "sm",
}: {
  employees: Employee[];
  max?: number;
  size?: keyof typeof AVATAR_SIZES;
}) {
  const visible = employees.slice(0, max);
  const remaining = employees.length - visible.length;

  return (
    <div className="flex items-center">
      {visible.map((employee, index) => (
        <span
          key={employee.id}
          className={cn(index > 0 && "-ml-2", "rounded-full ring-2 ring-card")}
        >
          <Avatar
            name={employee.name}
            seed={employee.id}
            size={size}
            className="ring-0"
          />
        </span>
      ))}
      {remaining > 0 && (
        <span
          className={cn(
            "-ml-2 inline-flex items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-2 ring-card",
            size === "xs" || size === "sm" ? "size-6" : "size-8",
          )}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}

// ── Badges ──────────────────────────────────────────────────────────────────

type BadgeVariant = ComponentProps<typeof ReuiBadge>["variant"];

export function Badge({
  children,
  dot,
  className,
  ...props
}: ComponentProps<typeof ReuiBadge> & { dot?: boolean }) {
  return (
    <ReuiBadge className={cn("font-medium", className)} {...props}>
      {dot && (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
      )}
      {children}
    </ReuiBadge>
  );
}

const SPKL_VARIANTS: Record<SpklStatus, BadgeVariant> = {
  berlangsung: "warning-light",
  terjadwal: "info-light",
  selesai: "success-light",
  dibatalkan: "outline",
};

export function SpklStatusBadge({
  status,
  className,
}: {
  status: SpklStatus;
  className?: string;
}) {
  return (
    <Badge
      variant={SPKL_VARIANTS[status]}
      dot={status === "berlangsung"}
      className={className}
    >
      {SPKL_STATUS_LABEL[status]}
    </Badge>
  );
}

const ATTENDANCE_VARIANTS: Record<AttendanceStatus, BadgeVariant> = {
  berjalan: "warning-light",
  selesai: "success-light",
  ditutup_otomatis: "info-light",
  tidak_hadir: "destructive-light",
  dikoreksi: "primary-light",
};

export function AttendanceBadge({
  status,
  className,
}: {
  status: AttendanceStatus;
  className?: string;
}) {
  return (
    <Badge
      variant={ATTENDANCE_VARIANTS[status]}
      dot={status === "berjalan"}
      className={className}
    >
      {ATTENDANCE_STATUS_LABEL[status]}
    </Badge>
  );
}

// ── Layout pieces ───────────────────────────────────────────────────────────

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && (
          <p className="text-xs font-medium text-muted-foreground">{eyebrow}</p>
        )}
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="text-sm font-semibold text-foreground">{children}</h2>
      {action}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-4 gap-y-2",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  );
}

const STAT_TONES = {
  primary: "text-primary",
  info: "text-info",
  warning: "text-warning",
  success: "text-success",
} as const;

export function StatCard({
  label,
  value,
  suffix,
  icon: Icon,
  visual,
  helper,
  tone = "primary",
  className,
}: {
  label: string;
  value: ReactNode;
  suffix?: string;
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  visual?: ReactNode;
  helper?: ReactNode;
  tone?: keyof typeof STAT_TONES;
  className?: string;
}) {
  return (
    <Card size="sm" className={className}>
      <CardHeader>
        <CardDescription className="text-xs font-medium">
          {label}
        </CardDescription>
        {Icon && (
          <CardAction>
            <IconTile
              variant="soft"
              size="sm"
              className={STAT_TONES[tone]}
              aria-hidden="true"
            >
              <Icon strokeWidth={2} />
            </IconTile>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </span>
          {suffix && (
            <span className="text-xs font-medium text-muted-foreground">
              {suffix}
            </span>
          )}
        </div>
        {visual && <div className="pt-0.5">{visual}</div>}
        {helper && (
          <div className="text-xs text-muted-foreground">{helper}</div>
        )}
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        {Icon && (
          <EmptyMedia variant="icon">
            <Icon strokeWidth={1.8} />
          </EmptyMedia>
        )}
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

const PROGRESS_TONES = {
  primary: "[&_[data-slot=progress-indicator]]:bg-primary",
  success: "[&_[data-slot=progress-indicator]]:bg-success",
  warning: "[&_[data-slot=progress-indicator]]:bg-warning",
  destructive: "[&_[data-slot=progress-indicator]]:bg-destructive",
  muted: "[&_[data-slot=progress-indicator]]:bg-muted-foreground",
} as const;

export function ProgressBar({
  value,
  max,
  tone = "primary",
  className,
}: {
  value: number;
  max: number;
  tone?: keyof typeof PROGRESS_TONES;
  className?: string;
}) {
  const percent =
    max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <Progress
      value={percent}
      className={cn("w-full", PROGRESS_TONES[tone], className)}
      aria-label={`${Math.round(percent)}%`}
    />
  );
}

export function LinkArrow({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-primary transition-colors hover:text-primary/70",
        className,
      )}
    >
      {children}
      <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" />
    </Link>
  );
}

const ALERT_VARIANTS = {
  info: "info",
  warning: "warning",
  success: "success",
  danger: "destructive",
} as const;

export function InfoBanner({
  icon: Icon,
  children,
  tone = "info",
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  tone?: keyof typeof ALERT_VARIANTS;
  className?: string;
}) {
  return (
    <Alert variant={ALERT_VARIANTS[tone]} className={className}>
      {Icon && <Icon />}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function FieldError({
  children,
  className,
  ...props
}: { children?: ReactNode } & Omit<ComponentProps<"p">, "children">) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn("text-xs font-medium text-destructive", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function DataRow({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-border py-3 text-sm last:border-0",
        className,
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
