import type { ReactNode } from "react";

export function PlatformAccountListView<T>({
  items,
  getKey,
  renderItem,
  emptyTitle,
  emptyDescription,
}: {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-slate-200 bg-white/80 px-6 py-10 text-center">
        <div className="text-base font-semibold text-slate-900">{emptyTitle}</div>
        <div className="mt-2 text-sm leading-6 text-slate-500">{emptyDescription}</div>
      </div>
    );
  }

  return <div className="space-y-4">{items.map((item) => <div key={getKey(item)}>{renderItem(item)}</div>)}</div>;
}
