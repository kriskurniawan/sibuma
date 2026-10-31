"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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

function eventPoint(event?: Event) {
  if (!event) return null;
  if (event instanceof MouseEvent) {
    return { x: event.clientX, y: event.clientY };
  }
  if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
    const touch = event.changedTouches[0] ?? event.touches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return null;
}

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
  // Klik kedua dari double-click pada tombol pemicu mendarat di backdrop yang
  // baru muncul. Tahan dismissal pointer sebentar agar dialog tidak berkedip
  // terbuka lalu langsung tertutup.
  const [pointerDismissalReady, setPointerDismissalReady] = useState(false);
  // Posisi tombol pemicu terakhir. Klik berulang di area tombol yang sekarang
  // tertutup overlay tidak boleh menutup dialog yang baru terbuka.
  const triggerRef = useRef<{ element: Element; at: number } | null>(null);
  const openTriggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      const record = triggerRef.current;
      if (
        record &&
        Date.now() - record.at < 1500 &&
        record.element.isConnected
      ) {
        openTriggerRef.current = record.element;
        return;
      }
      // Dialog yang dibuka dari intent pra-hidrasi tidak sempat mencatat
      // pointerdown lewat React; pakai elemen pemicu yang disimpan hook.
      const pendingTrigger = window.__sibumaDialogTriggerElement;
      const pendingAt = window.__sibumaDialogTriggerAt ?? 0;
      delete window.__sibumaDialogTriggerElement;
      delete window.__sibumaDialogTriggerAt;
      if (
        pendingTrigger &&
        Date.now() - pendingAt < 1500 &&
        pendingTrigger.isConnected
      ) {
        openTriggerRef.current = pendingTrigger;
        return;
      }
      const active = document.activeElement;
      openTriggerRef.current =
        active instanceof Element && active !== document.body ? active : null;
      return;
    }
    openTriggerRef.current = null;
  }, [open]);

  useEffect(() => {
    if (open) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger =
        target.closest("button, a, [role='button'], [data-dialog-intent]") ??
        target;
      triggerRef.current = { element: trigger, at: Date.now() };
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPointerDismissalReady(false);
      return;
    }
    const timer = window.setTimeout(() => setPointerDismissalReady(true), 400);
    return () => window.clearTimeout(timer);
  }, [open]);

  function isTriggerPoint(event?: Event) {
    const trigger = openTriggerRef.current;
    if (!trigger || !trigger.isConnected) return false;
    const point = eventPoint(event);
    if (!point) return false;
    const rect = trigger.getBoundingClientRect();
    return (
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom
    );
  }

  function handleOpenChange(
    nextOpen: boolean,
    details: { reason: string; event?: Event },
  ) {
    if (nextOpen) return;
    // Klik kedua dan seterusnya pada tombol pemicu bisa mendarat di backdrop
    // atau di tombol Close yang bergeser ke bawah kursor saat dialog
    // beranimasi. Abaikan selama masa pengaman atau selama masih rangkaian
    // klik berulang.
    const repeatedClick =
      details.event instanceof MouseEvent && details.event.detail > 1;
    if (
      (details.reason === "outside-press" ||
        details.reason === "close-press") &&
      (!pointerDismissalReady || repeatedClick)
    ) {
      return;
    }
    // Jangan tutup dialog ketika pengguna masih menekan area tombol pemicu
    // yang kini berada di balik overlay. Klik di area lain tetap menutup.
    if (details.reason === "outside-press" && isTriggerPoint(details.event)) {
      return;
    }
    if (!dismissible && details.reason !== "close-press") return;
    onClose();
  }

  if (mobileSheet && isMobile) {
    return (
      <Sheet
        open={open}
        onOpenChange={handleOpenChange}
        disablePointerDismissal={!dismissible || !pointerDismissalReady}
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
      disablePointerDismissal={!dismissible || !pointerDismissalReady}
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
