export interface ChecklistLocationHierarchyNode {
  id: string;
  name: string;
  parentId: string | null;
}

export interface ChecklistLocationOption extends ChecklistLocationHierarchyNode {
  /** Nama lengkap dari akar hierarki, mis. "Gedung A / Ruang Rapat". */
  path: string;
}

const collator = new Intl.Collator("id", {
  numeric: true,
  sensitivity: "base",
});

function compareLocations(
  left: ChecklistLocationHierarchyNode,
  right: ChecklistLocationHierarchyNode,
) {
  return collator.compare(left.name, right.name) || left.id.localeCompare(right.id);
}

function locationPath(
  node: ChecklistLocationHierarchyNode,
  byId: Map<string, ChecklistLocationHierarchyNode>,
) {
  const parts = [node.name];
  const seen = new Set([node.id]);
  let current = node;

  while (current.parentId) {
    if (seen.has(current.parentId)) break;
    const parent = byId.get(current.parentId);
    if (!parent) break;
    seen.add(parent.id);
    parts.unshift(parent.name);
    current = parent;
  }

  return parts.join(" / ");
}

/**
 * Mengubah daftar lokasi datar menjadi urutan hierarkis dengan label path.
 * Aman untuk data tidak lengkap: lokasi yatim tetap tampil sebagai akar dan
 * siklus induk tidak membuat proses berulang tanpa henti.
 */
export function buildChecklistLocationOptions<T extends ChecklistLocationHierarchyNode>(
  locations: T[],
): Array<T & { path: string }> {
  const byId = new Map<string, T>(locations.map((location) => [location.id, location]));
  const roots: T[] = [];
  const children = new Map<string, T[]>();

  for (const location of locations) {
    const parent =
      location.parentId && location.parentId !== location.id
        ? byId.get(location.parentId)
        : null;
    if (!parent) {
      roots.push(location);
      continue;
    }
    const siblings = children.get(parent.id) ?? [];
    siblings.push(location);
    children.set(parent.id, siblings);
  }

  roots.sort(compareLocations);
  for (const siblings of children.values()) siblings.sort(compareLocations);

  const ordered: T[] = [];
  const seen = new Set<string>();
  const visit = (location: T) => {
    if (seen.has(location.id)) return;
    seen.add(location.id);
    ordered.push(location);
    for (const child of children.get(location.id) ?? []) visit(child);
  };

  for (const root of roots) visit(root);
  // Sisa node yang tidak terjangkau (mis. siklus induk) tetap ditampilkan.
  for (const location of locations) visit(location);

  return ordered.map((location) => ({
    ...location,
    path: locationPath(location, byId),
  }));
}
