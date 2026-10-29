"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  Frame,
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

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeToDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function isDesktop() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

/** Secondary account details stay expanded on desktop, optional on mobile. */
export function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const desktop = useSyncExternalStore(subscribeToDesktop, isDesktop, () => false);
  const [expanded, setExpanded] = useState(false);

  return (
    <Collapsible
      open={desktop || expanded}
      onOpenChange={setExpanded}
      render={<Frame spacing="default" />}
    >
      <FrameHeader className="flex-row items-center justify-between gap-3">
        <FrameTitle>{title}</FrameTitle>
        <CollapsibleTrigger
          render={<Button type="button" variant="ghost" size="icon-sm" />}
          aria-label={`${expanded ? "Tutup" : "Lihat"} ${title.toLowerCase()}`}
          className="lg:hidden"
        >
          <ChevronDown aria-hidden="true" />
        </CollapsibleTrigger>
      </FrameHeader>
      <CollapsibleContent>
        <FramePanel className="flex min-w-0 flex-col gap-4">
          {children}
        </FramePanel>
      </CollapsibleContent>
    </Collapsible>
  );
}
