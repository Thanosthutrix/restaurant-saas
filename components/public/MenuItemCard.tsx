import Image from "next/image";
import { getMenuCategoryEmoji } from "@/lib/public/menuCategories";
import type { MenuItem } from "@/lib/public/types";

type Props = {
  item: MenuItem;
};

export function MenuItemCard({ item }: Props) {
  const placeholder = getMenuCategoryEmoji(item.category);

  return (
    <article className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-orange-200 hover:shadow-md">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-28 sm:w-28">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className="object-cover"
            sizes="112px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl">{placeholder}</div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-slate-900">{item.name}</h3>
          <p className="shrink-0 text-lg font-bold text-orange-600">
            {item.price.toFixed(2).replace(".", ",")} €
          </p>
        </div>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">
          {item.description}
        </p>
      </div>
    </article>
  );
}
