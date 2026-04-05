import { resolveLucideIconForCategoryTitle } from "@/lib/catalog/categoryPictogram";

export { resolveLucideIconForCategoryTitle };

type PictogramProps = {
  title: string;
  depth: number;
  className?: string;
};

/**
 * Pictogramme Lucide déduit du libellé de rubrique (restaurant / carte / stock).
 */
export function CategoryPictogram({ title, depth, className = "" }: PictogramProps) {
  const Icon = resolveLucideIconForCategoryTitle(title);
  const size = depth > 0 ? "h-4 w-4" : "h-[1.15rem] w-[1.15rem] sm:h-5 sm:w-5";
  return (
    <Icon
      className={`shrink-0 text-indigo-600 ${size} ${className}`.trim()}
      aria-hidden
    />
  );
}
