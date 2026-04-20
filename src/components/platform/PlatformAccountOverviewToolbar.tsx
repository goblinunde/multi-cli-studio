import { LayoutGrid, List, Search } from "lucide-react";
import type { ReactNode } from "react";
import type { PlatformAccountViewMode } from "../../lib/models";
import { PaginationControls } from "../PaginationControls";

export type PlatformOverviewFilterChip = {
  id: string;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
};

export type PlatformOverviewPagination = {
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
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function PlatformAccountOverviewToolbar({
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
  viewMode,
  onViewModeChange,
  filters,
  summary,
  actions,
  pagination,
}: {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchPlaceholder: string;
  viewMode: PlatformAccountViewMode;
  onViewModeChange: (mode: PlatformAccountViewMode) => void;
  filters?: PlatformOverviewFilterChip[];
  summary?: ReactNode;
  actions?: ReactNode;
  pagination?: PlatformOverviewPagination;
}) {
  return (
    <section className="rounded-[20px] border border-[#e8e3d8] bg-white/92 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 items-center gap-3 rounded-[14px] border border-slate-200 bg-[#fbfaf8] px-4 py-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-sm text-slate-700 outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <div className="inline-flex items-center gap-1 rounded-[14px] border border-slate-200 bg-[#fbfaf8] p-1">
            <button
              type="button"
              onClick={() => onViewModeChange("grid")}
              className={cx(
                "inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium transition",
                viewMode === "grid"
                  ? "bg-white text-slate-900 shadow-[0_8px_20px_rgba(15,23,42,0.10)]"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              卡片
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              className={cx(
                "inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium transition",
                viewMode === "list"
                  ? "bg-white text-slate-900 shadow-[0_8px_20px_rgba(15,23,42,0.10)]"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              <List className="h-4 w-4" />
              列表
            </button>
          </div>
        </div>
      </div>

      {summary ? <div className="mt-4 text-sm leading-6 text-slate-500">{summary}</div> : null}

      {filters && filters.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={filter.onClick}
              className={cx(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                filter.active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
              )}
            >
              <span>{filter.label}</span>
              {typeof filter.count === "number" ? (
                <span
                  className={cx(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    filter.active ? "bg-white/15 text-white" : "bg-white text-slate-500"
                  )}
                >
                  {filter.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {pagination ? (
        <div className="mt-4">
          <PaginationControls {...pagination} />
        </div>
      ) : null}
    </section>
  );
}
