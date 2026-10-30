import { Badge } from "@/components/ui";
import {
  workDocumentExtensionLabel,
  type WorkDocumentShares,
} from "@/lib/work-document-types";

export function DocumentTypeBadge({ extension }: { extension: string }) {
  return <Badge variant="outline">{workDocumentExtensionLabel(extension)}</Badge>;
}

export function DocumentShareBadges({
  shares,
  className,
}: {
  shares: WorkDocumentShares;
  className?: string;
}) {
  if (!shares.division && !shares.supervisor) {
    return (
      <span className={className}>
        <Badge variant="outline">Privat</Badge>
      </span>
    );
  }
  return (
    <span className={className}>
      <span className="flex flex-wrap items-center gap-1">
        {shares.division && <Badge variant="info-light">Divisi</Badge>}
        {shares.supervisor && <Badge variant="primary-light">Atasan</Badge>}
      </span>
    </span>
  );
}
