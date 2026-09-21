import type { Category } from "./types";

export type CategoryOption = { id: string; label: string };

/** Flattens categories into select options: top-level categories followed by their indented subcategories. */
export function categorySelectOptions(categories: Category[]): CategoryOption[] {
  const topLevel = categories.filter((c) => !c.parent_category_id);
  const options: CategoryOption[] = [];
  for (const top of topLevel) {
    options.push({ id: top.id, label: top.name });
    for (const child of categories.filter((c) => c.parent_category_id === top.id)) {
      options.push({ id: child.id, label: `— ${child.name}` });
    }
  }
  return options;
}
