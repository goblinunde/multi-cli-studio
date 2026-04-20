export type PlatformOverviewBulkAction = {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function PlatformAccountSelectionBar({
  selectedCount,
  totalCount,
  onToggleSelectPage,
  allPageSelected,
  actions,
}: {
  selectedCount: number;
  totalCount: number;
  onToggleSelectPage: () => void;
  allPageSelected: boolean;
  actions: PlatformOverviewBulkAction[];
}) {
  if (totalCount === 0) return null;

  return (
    <section className="rounded-[18px] border border-slate-200 bg-[#fbfaf8] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={allPageSelected} onChange={onToggleSelectPage} />
            <span>本页全选</span>
          </label>
          <span>
            已选 {selectedCount} 项 / 当前结果 {totalCount} 项
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={cx(
                "rounded-[12px] border px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
                action.tone === "danger"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-slate-200 bg-white text-slate-700"
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
