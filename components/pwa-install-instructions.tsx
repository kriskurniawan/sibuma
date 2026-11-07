"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import {
  pwaInstallGuide,
  readPwaEnvironment,
  type PwaEnvironment,
} from "@/lib/pwa-client";

/** Shared by the mobile install action and Profile notification settings. */
export function PwaInstallInstructions({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [environment, setEnvironment] = useState<PwaEnvironment | null>(null);

  useEffect(() => {
    if (open) setEnvironment(readPwaEnvironment());
  }, [open]);

  const guide = pwaInstallGuide(environment);

  return (
    <Modal
      open={open && environment !== null}
      onClose={onClose}
      title="Pasang SIBUMA"
      description={guide.description}
      size="sm"
      mobileSheet
      footer={
        <Button type="button" size="sm" onClick={onClose}>
          Mengerti
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <ol className="flex flex-col gap-3">
          {guide.steps.map((step, index) => (
            <li key={step} className="flex items-start gap-3 text-sm">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums text-foreground">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">{guide.note}</p>
      </div>
    </Modal>
  );
}
