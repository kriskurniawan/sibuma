"use client";

import { useRef, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
  mobileSheet = false,
  stickyFooter = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof SIZE_CLASSES;
  dismissible?: boolean;
  mobileSheet?: boolean;
  stickyFooter?: boolean;
}) {
  const isMobile = useIsMobile();
  // Di perangkat sentuh, fokuskan wadah dialog agar keyboard tidak langsung
  // terbuka; pengguna mengetuk kolom sendiri saat siap mengisi.
  const contentRef = useRef<HTMLDivElement>(null);

  function handleOpenChange(nextOpen: boolean, details: { reason: string }) {
    if (nextOpen) return;
    if (!dismissible && details.reason !== "close-press") return;
    onClose();
  }

  if (mobileSheet && isMobile) {
    return (
      <Sheet
        open={open}
        onOpenChange={handleOpenChange}
        disablePointerDismissal={!dismissible}
      >
        <SheetContent
          ref={contentRef}
          side="bottom"
          showCloseButton={dismissible}
          className="max-h-[85dvh] gap-0"
          initialFocus={contentRef}
        >
          <SheetHeader className="border-b border-border/70">
            {title ? (
              <SheetTitle>{title}</SheetTitle>
            ) : (
              <SheetTitle className="sr-only">Dialog</SheetTitle>
            )}
            {description && (
              <SheetDescription>{description}</SheetDescription>
            )}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {children}
          </div>
          {footer && (
            <SheetFooter className="flex-row justify-end border-t border-border/70 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      disablePointerDismissal={!dismissible}
    >
      <DialogContent
        ref={contentRef}
        showCloseButton={dismissible}
        initialFocus={isMobile ? contentRef : undefined}
        className={cn(
          "max-h-[calc(100svh-2rem)]",
          stickyFooter
            ? "grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden"
            : "overflow-y-auto",
          SIZE_CLASSES[size],
        )}
      >
        <DialogHeader>
          {title ? (
            <DialogTitle>{title}</DialogTitle>
          ) : (
            <DialogTitle className="sr-only">Dialog</DialogTitle>
          )}
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div
          className={cn(
            "min-w-0",
            stickyFooter && "min-h-0 overflow-y-auto",
          )}
        >
          {children}
        </div>
        {footer && (
          <DialogFooter className={stickyFooter ? "bg-muted" : undefined}>
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
