import { Building2, UserRoundCheck } from "lucide-react";
import { Badge } from "@/components/ui";
import type { WorkDocumentShareTarget } from "@/lib/work-document-types";

export function DocumentShareSummary({
  targets,
  empty,
}: {
  targets: WorkDocumentShareTarget[];
  empty: string;
}) {
  if (targets.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  const divisions = targets.filter((target) => target.audience === "division");
  const supervisors = targets.filter(
    (target) => target.audience === "supervisor",
  );
  return (
    <div className="flex flex-col gap-3">
      {divisions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Divisi
          </span>
          <div className="flex flex-wrap gap-1.5">
            {divisions.map((target) => (
              <Badge
                key={target.targetId}
                variant="info-light"
                title={target.legacy ? "Dari pengaturan berbagi lama" : undefined}
              >
                <Building2 aria-hidden="true" />
                {target.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {supervisors.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Atasan
          </span>
          <div className="flex flex-wrap gap-1.5">
            {supervisors.map((target) => (
              <Badge
                key={target.targetId}
                variant="primary-light"
                title={target.legacy ? "Dari pengaturan berbagi lama" : undefined}
              >
                <UserRoundCheck aria-hidden="true" />
                {target.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
