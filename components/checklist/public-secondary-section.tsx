"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const DESKTOP_QUERY = "(min-width: 48rem)";

function subscribeToDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function isDesktop() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

/** Keep secondary records optional on phones without hiding desktop content. */
export function PublicSecondarySection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const desktop = useSyncExternalStore(subscribeToDesktop, isDesktop, () => false);
  const [expanded, setExpanded] = useState(false);

  return (
    <Collapsible
      open={desktop || expanded}
      onOpenChange={setExpanded}
      render={<Frame spacing="default" className="min-w-0" />}
    >
      <FrameHeader className="flex-row items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <FrameTitle><h2>{title}</h2></FrameTitle>
          <FrameDescription className="text-xs">{description}</FrameDescription>
        </div>
        <CollapsibleTrigger
          render={<Button type="button" variant="ghost" size="icon-sm" />}
          aria-label={`${expanded ? "Tutup" : "Lihat"} ${title.toLowerCase()}`}
          className="shrink-0 md:hidden"
        >
          <ChevronDown aria-hidden="true" />
        </CollapsibleTrigger>
      </FrameHeader>
      <CollapsibleContent>
        <FramePanel>{children}</FramePanel>
      </CollapsibleContent>
    </Collapsible>
  );
}
