"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FolderClosed, FolderMinus, FolderOpen, FolderPlus, Files } from "lucide-react";
import { DocumentFolderDialog } from "@/components/dokumen/document-folder-dialog";
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { WorkDocumentFolder } from "@/lib/work-document-types";

/** `all` = seluruh dokumen, `none` = belum berfolder, selain itu id folder. */
export type DocumentFolderFilter = string;

export function DocumentFolders({
  folders,
  activeFolder,
  unfiledCount,
  readOnly,
}: {
  folders: WorkDocumentFolder[];
  activeFolder: DocumentFolderFilter;
  unfiledCount: number;
  readOnly: boolean;
}) {
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const allCount =
    unfiledCount + folders.reduce((sum, folder) => sum + folder.documentCount, 0);

  function hrefFor(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("folder");
    else params.set("folder", value);
    params.delete("page");
    const query = params.toString();
    return query ? `/dokumen?${query}` : "/dokumen";
  }

  const items = [
    { value: "all", label: "Semua dokumen", icon: Files, count: allCount },
    { value: "none", label: "Tanpa folder", icon: FolderMinus, count: unfiledCount },
    ...folders.map((folder) => ({
      value: folder.id,
      label: folder.name,
      icon: FolderClosed,
      count: folder.documentCount,
    })),
  ];

  return (
    <>
      <Frame stacked spacing="sm">
        <FrameHeader className="flex-row items-center justify-between gap-2">
          <FrameTitle>Folder</FrameTitle>
          {!readOnly && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Buat folder baru"
              title="Buat folder baru"
              onClick={() => setCreateOpen(true)}
            >
              <FolderPlus aria-hidden="true" />
            </Button>
          )}
        </FrameHeader>
        <FramePanel className="p-1">
          <nav aria-label="Folder dokumen" className="flex flex-col gap-0.5">
            {items.map((item) => {
              const active = item.value === activeFolder;
              const Icon = active ? FolderOpen : item.icon;
              return (
                <Link
                  key={item.value}
                  href={hrefFor(item.value)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <Badge
                    variant={active ? "primary-light" : "outline"}
                    className="tabular-nums"
                  >
                    {item.count}
                  </Badge>
                </Link>
              );
            })}
          </nav>
        </FramePanel>
      </Frame>

      <DocumentFolderDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </>
  );
}
