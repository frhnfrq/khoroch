import type { Category } from "@khoroch/db/schema";

export function getCategoryPath(category: Category, categories: Category[]) {
  const byId = new Map(categories.map((item) => [item.id, item]));
  const names = [category.name];
  const visited = new Set([category.id]);
  let parentId = category.parentId;

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parentId;
  }

  return names.join(" › ");
}

export function getCategoryDepth(category: Category, categories: Category[]) {
  const byId = new Map(categories.map((item) => [item.id, item]));
  const visited = new Set([category.id]);
  let depth = 0;
  let parentId = category.parentId;

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parentId;
  }

  return depth;
}
