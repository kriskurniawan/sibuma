import {
  FileSpreadsheet,
  FileText,
  FileType2,
  Film,
  ImageIcon,
  Presentation,
} from "lucide-react";
import { IconTile } from "@/components/reui/icon-tile";
import { cn } from "@/lib/utils";
import { workDocumentKind } from "@/lib/work-document-types";

const KIND_STYLE = {
  pdf: { icon: FileText, tone: "text-destructive" },
  image: { icon: ImageIcon, tone: "text-info" },
  document: { icon: FileType2, tone: "text-primary" },
  spreadsheet: { icon: FileSpreadsheet, tone: "text-success" },
  presentation: { icon: Presentation, tone: "text-warning" },
  video: { icon: Film, tone: "text-chart-4" },
  file: { icon: FileText, tone: "text-muted-foreground" },
} as const;

export function DocumentFileIcon({
  extension,
  size = "sm",
  className,
}: {
  extension: string;
  size?: "xs" | "sm" | "default" | "lg";
  className?: string;
}) {
  const style = KIND_STYLE[workDocumentKind(extension)];
  const Icon = style.icon;
  return (
    <IconTile
      variant="soft"
      size={size}
      className={cn(style.tone, className)}
    >
      <Icon aria-hidden="true" />
    </IconTile>
  );
}
