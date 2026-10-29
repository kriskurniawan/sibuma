import { Clock3, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui";
import type { Documentation, Employee, Spkl } from "@/lib/types";
import { formatDateHuman, formatTime } from "@/lib/time";
import { cn, documentSrc } from "@/lib/utils";

export function DocumentationCard({
  doc,
  employee,
  spkl,
  className,
  onClick,
}: {
  doc: Documentation;
  employee: Employee | null;
  spkl?: Spkl;
  className?: string;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group flex min-w-0 flex-col gap-2 text-left",
        onClick && "cursor-pointer",
        className,
      )}
    >
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg bg-muted">
        <img
          src={documentSrc(doc.storageKey)}
          alt={doc.description}
          className="size-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.02] motion-reduce:transform-none"
          loading="lazy"
        />
        <div className="absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-black/40 to-transparent" />
        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
          <Clock3 className="size-3" />
          {formatTime(doc.takenAt)}
        </span>
        {doc.location && (
          <span className="absolute bottom-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-white/90 text-foreground backdrop-blur">
            <MapPin className="size-3" />
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        {spkl && (
          <p className="truncate text-xs font-medium text-muted-foreground">
            {spkl.title}
          </p>
        )}
        <p className="line-clamp-2 text-sm font-medium leading-relaxed text-foreground">
          {doc.description}
        </p>
        <div className="mt-1 flex items-center gap-2">
          {employee && (
            <Avatar name={employee.name} seed={employee.id} size="xs" />
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">
              {employee?.name ?? "Pekerja"}
            </p>
            <p className="text-xs text-muted-foreground">
              Diunggah {formatDateHuman(doc.takenAt, "d MMM, HH:mm")}
            </p>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}

export function DocumentationPlaceholder({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex aspect-4/3 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/30",
        className,
      )}
    >
      <span className="text-lg font-semibold tabular-nums text-muted-foreground">
        {String(count).padStart(2, "0")}
      </span>
      <span className="text-xs font-medium text-muted-foreground">Foto</span>
    </div>
  );
}
