export function PaginationControls({
  totalItems,
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions,
  rangeStart,
  rangeEnd,
  canGoPrevious,
  canGoNext,
  onPageSizeChange,
  onPreviousPage,
  onNextPage,
}: {
  totalItems: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  rangeStart: number;
  rangeEnd: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPageSizeChange: (pageSize: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  if (totalItems === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-[#eceae4] bg-white/92 px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)] lg:flex-row lg:items-center lg:justify-between">
      <div className="text-sm text-slate-500">
        显示 {rangeStart} - {rangeEnd} / 共 {totalItems}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={String(pageSize)}
          onChange={(event) => onPageSizeChange(Number.parseInt(event.target.value, 10))}
          className="rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          {pageSizeOptions.map((count) => (
            <option key={count} value={count}>
              {count} / 页
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!canGoPrevious}
          onClick={onPreviousPage}
          className="rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          上一页
        </button>
        <span className="px-2 text-sm text-slate-500">
          第 {currentPage} / {totalPages} 页
        </span>
        <button
          type="button"
          disabled={!canGoNext}
          onClick={onNextPage}
          className="rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
