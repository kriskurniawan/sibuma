/** Shared semantic accents for desktop and mobile summaries. */
export const SUMMARY_TONES = {
  primary: {
    icon: "text-primary",
    surface: "bg-primary/5 dark:bg-primary/10",
    hover: "hover:bg-primary/10 dark:hover:bg-primary/15",
  },
  info: {
    icon: "text-info",
    surface: "bg-card",
    hover: "hover:bg-muted/40",
  },
  success: {
    icon: "text-success",
    surface: "bg-success/5 dark:bg-success/10",
    hover: "hover:bg-success/10 dark:hover:bg-success/15",
  },
  warning: {
    icon: "text-warning",
    surface: "bg-warning/5 dark:bg-warning/10",
    hover: "hover:bg-warning/10 dark:hover:bg-warning/15",
  },
  destructive: {
    icon: "text-destructive",
    surface: "bg-destructive/5 dark:bg-destructive/10",
    hover: "hover:bg-destructive/10 dark:hover:bg-destructive/15",
  },
  neutral: {
    icon: "text-muted-foreground",
    surface: "bg-card",
    hover: "hover:bg-muted/40",
  },
} as const;

export type SummaryTone = keyof typeof SUMMARY_TONES;
