"use client";

import { FolderTree, ListChecks, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHECKLIST_MAX_GROUPS,
  CHECKLIST_MAX_ITEMS,
  CHECKLIST_PHOTO_POLICY_LABEL,
  type ChecklistItemType,
  type ChecklistPhotoPolicy,
  type ChecklistTemplateItem,
} from "@/lib/checklist-types";
import { cn } from "@/lib/utils";

export interface TemplateItemDraft {
  itemType: ChecklistItemType;
  parentIndex: number | null;
  prompt: string;
  guidance: string;
  required: boolean;
  photoPolicy: ChecklistPhotoPolicy;
  requireNoteOnIssue: boolean;
  publicVisible: boolean;
}

export const PHOTO_POLICIES: ChecklistPhotoPolicy[] = [
  "opsional",
  "wajib",
  "wajib_saat_masalah",
];

export function emptyTemplateItem(): TemplateItemDraft {
  return {
    itemType: "item",
    parentIndex: null,
    prompt: "",
    guidance: "",
    required: true,
    photoPolicy: "opsional",
    requireNoteOnIssue: true,
    publicVisible: false,
  };
}

export function emptyTemplateGroup(): TemplateItemDraft {
  return {
    ...emptyTemplateItem(),
    itemType: "grup",
    required: false,
    requireNoteOnIssue: false,
  };
}

export function toTemplateDraft(items: ChecklistTemplateItem[]): TemplateItemDraft[] {
  const indexById = new Map(items.map((item, index) => [item.id, index]));
  return items.map((item) => ({
    itemType: item.itemType ?? "item",
    parentIndex: item.parentItemId
      ? (indexById.get(item.parentItemId) ?? null)
      : null,
    prompt: item.prompt,
    guidance: item.guidance,
    required: item.required,
    photoPolicy: item.photoPolicy,
    requireNoteOnIssue: item.requireNoteOnIssue,
    publicVisible: item.publicVisible,
  }));
}

export function validateTemplateDraft(items: TemplateItemDraft[]): string | null {
  const leaves = items.filter((item) => item.itemType === "item");
  if (leaves.length === 0) return "Tambahkan minimal satu item checklist.";
  if (leaves.length > CHECKLIST_MAX_ITEMS) {
    return `Maksimal ${CHECKLIST_MAX_ITEMS} item per template.`;
  }
  if (items.filter((item) => item.itemType === "grup").length > CHECKLIST_MAX_GROUPS) {
    return `Maksimal ${CHECKLIST_MAX_GROUPS} grup per template.`;
  }
  if (items.some((item) => item.prompt.trim().length < 3)) {
    return "Setiap grup dan item minimal 3 karakter.";
  }
  const groupNames = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (item.itemType !== "grup") continue;
    const normalized = item.prompt.trim().toLowerCase();
    if (groupNames.has(normalized)) {
      return `Nama grup "${item.prompt.trim()}" dipakai lebih dari sekali.`;
    }
    groupNames.add(normalized);
    if (!items.some((child) => child.parentIndex === index)) {
      return `Grup "${item.prompt.trim()}" belum punya sub-item.`;
    }
  }
  return null;
}

function insertNode(
  items: TemplateItemDraft[],
  at: number,
  node: TemplateItemDraft,
): TemplateItemDraft[] {
  const next = [...items.slice(0, at), node, ...items.slice(at)];
  return next.map((item, index) => {
    if (index === at) return item;
    if (item.parentIndex !== null && item.parentIndex >= at) {
      return { ...item, parentIndex: item.parentIndex + 1 };
    }
    return item;
  });
}

function removeNode(
  items: TemplateItemDraft[],
  index: number,
): TemplateItemDraft[] {
  const removed = new Set<number>([index]);
  items.forEach((item, itemIndex) => {
    if (item.parentIndex === index) removed.add(itemIndex);
  });
  const next = items.filter((_, itemIndex) => !removed.has(itemIndex));
  return next.map((item) => {
    if (item.parentIndex === null) return item;
    let shift = 0;
    for (const removedIndex of removed) {
      if (removedIndex < item.parentIndex) shift += 1;
    }
    return shift === 0
      ? item
      : { ...item, parentIndex: item.parentIndex - shift };
  });
}

export function TemplateItemEditor({
  items,
  onChange,
  disabled,
}: {
  items: TemplateItemDraft[];
  onChange: (items: TemplateItemDraft[]) => void;
  disabled?: boolean;
}) {
  function update(index: number, patch: Partial<TemplateItemDraft>) {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function remove(index: number) {
    onChange(removeNode(items, index));
  }

  function addGroup() {
    onChange([...items, emptyTemplateGroup()]);
  }

  function addItem() {
    onChange([...items, emptyTemplateItem()]);
  }

  function addChild(parentIndex: number) {
    let insertAt = parentIndex + 1;
    items.forEach((item, index) => {
      if (item.parentIndex === parentIndex) insertAt = index + 1;
    });
    onChange(
      insertNode(items, insertAt, {
        ...emptyTemplateItem(),
        parentIndex,
      }),
    );
  }

  const childrenOf = (parentIndex: number) =>
    items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.parentIndex === parentIndex);

  const roots = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.parentIndex === null);

  let groupNumber = 0;
  const rows = roots.map(({ item, index }) => {
    if (item.itemType === "grup") groupNumber += 1;
    return {
      item,
      index,
      groupNumber: item.itemType === "grup" ? groupNumber : null,
    };
  });

  const leafCount = items.filter((item) => item.itemType === "item").length;
  const groupCount = items.filter((item) => item.itemType === "grup").length;
  // Removing a group also removes its children, so only allow it when at least
  // one other node remains.
  const canRemoveNode = (index: number) =>
    items.length -
      1 -
      items.filter((item) => item.parentIndex === index).length >
    0;

  return (
    <div className="flex flex-col gap-3">
      {rows.map(({ item, index, groupNumber }) => {
        if (item.itemType !== "grup") {
          return (
            <LeafBlock
              key={index}
              item={item}
              index={index}
              disabled={disabled}
              canRemove={canRemoveNode(index)}
              onPatch={(patch) => update(index, patch)}
              onRemove={() => remove(index)}
            />
          );
        }

        const children = childrenOf(index);
        return (
          <section
            key={index}
            className="flex flex-col gap-3 border-l-2 border-border/70 pl-3"
          >
            <div className="flex flex-col gap-3 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <FolderTree className="size-3.5" aria-hidden="true" />
                  Grup {groupNumber}
                </span>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Hapus grup ${groupNumber}`}
                  onClick={() => remove(index)}
                  disabled={disabled || !canRemoveNode(index)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`group-prompt-${index}`}>Nama grup</Label>
                <Input
                  id={`group-prompt-${index}`}
                  value={item.prompt}
                  onChange={(event) =>
                    update(index, { prompt: event.target.value })
                  }
                  maxLength={300}
                  placeholder="Contoh: Pemeriksaan Pompa"
                  disabled={disabled}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`group-guidance-${index}`}>
                  Keterangan grup (opsional)
                </Label>
                <Input
                  id={`group-guidance-${index}`}
                  value={item.guidance}
                  onChange={(event) =>
                    update(index, { guidance: event.target.value })
                  }
                  maxLength={600}
                  placeholder="Apa yang dicakup grup ini…"
                  disabled={disabled}
                />
              </div>
            </div>

            {children.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Belum ada sub-item. Tambahkan minimal satu sub-item di bawah.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {children.map((child) => (
                  <LeafBlock
                    key={child.index}
                    item={child.item}
                    index={child.index}
                    nested
                    disabled={disabled}
                    canRemove={canRemoveNode(child.index)}
                    onPatch={(patch) => update(child.index, patch)}
                    onRemove={() => remove(child.index)}
                  />
                ))}
              </div>
            )}

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addChild(index)}
              disabled={disabled || leafCount >= CHECKLIST_MAX_ITEMS}
              className="self-start"
            >
              <Plus aria-hidden="true" />
              Tambah sub-item
            </Button>
          </section>
        );
      })}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addGroup}
          disabled={disabled || groupCount >= CHECKLIST_MAX_GROUPS}
        >
          <FolderTree aria-hidden="true" />
          Tambah grup
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addItem}
          disabled={disabled || leafCount >= CHECKLIST_MAX_ITEMS}
        >
          <Plus aria-hidden="true" />
          Tambah item
        </Button>
      </div>
    </div>
  );
}

function LeafBlock({
  item,
  index,
  nested,
  disabled,
  canRemove,
  onPatch,
  onRemove,
}: {
  item: TemplateItemDraft;
  index: number;
  nested?: boolean;
  disabled?: boolean;
  canRemove: boolean;
  onPatch: (patch: Partial<TemplateItemDraft>) => void;
  onRemove: () => void;
}) {
  const name = nested ? "sub-item" : "item";
  return (
    <div className={cn("flex flex-col gap-3 p-3", nested ? "bg-muted/10" : "bg-muted/20")}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ListChecks className="size-3.5" aria-hidden="true" />
          {nested ? "Sub-item" : "Item"}
        </span>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={`Hapus ${name} ${index + 1}`}
          onClick={onRemove}
          disabled={disabled || !canRemove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`item-prompt-${index}`}>Isi {name}</Label>
        <Input
          id={`item-prompt-${index}`}
          value={item.prompt}
          onChange={(event) => onPatch({ prompt: event.target.value })}
          maxLength={300}
          placeholder={
            nested
              ? "Contoh: Periksa kondisi gear pompa"
              : "Contoh: Periksa kondisi lampu koridor"
          }
          disabled={disabled}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`item-guidance-${index}`}>
          Panduan pengisian (opsional)
        </Label>
        <Input
          id={`item-guidance-${index}`}
          value={item.guidance}
          onChange={(event) => onPatch({ guidance: event.target.value })}
          maxLength={600}
          placeholder="Apa yang perlu diperiksa atau dicatat…"
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`item-photo-${index}`}>Kebijakan foto</Label>
          <Select
            value={item.photoPolicy}
            onValueChange={(value) =>
              onPatch({ photoPolicy: value as ChecklistPhotoPolicy })
            }
            items={PHOTO_POLICIES.map((value) => ({
              value,
              label: CHECKLIST_PHOTO_POLICY_LABEL[value],
            }))}
            disabled={disabled}
          >
            <SelectTrigger
              id={`item-photo-${index}`}
              size="sm"
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHOTO_POLICIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {CHECKLIST_PHOTO_POLICY_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col justify-end gap-2">
          <Label className="flex items-center gap-2 text-sm font-normal text-foreground">
            <Checkbox
              checked={item.required}
              onCheckedChange={(checked) =>
                onPatch({ required: checked === true })
              }
              disabled={disabled}
            />
            Wajib diisi
          </Label>
          <Label className="flex items-center gap-2 text-sm font-normal text-foreground">
            <Checkbox
              checked={item.requireNoteOnIssue}
              onCheckedChange={(checked) =>
                onPatch({ requireNoteOnIssue: checked === true })
              }
              disabled={disabled}
            />
            Catatan wajib saat bermasalah
          </Label>
          <Label className="flex items-center gap-2 text-sm font-normal text-foreground">
            <Checkbox
              checked={item.publicVisible}
              onCheckedChange={(checked) =>
                onPatch({ publicVisible: checked === true })
              }
              disabled={disabled}
            />
            Tampilkan hasil item ke pengunjung
          </Label>
        </div>
      </div>
    </div>
  );
}
