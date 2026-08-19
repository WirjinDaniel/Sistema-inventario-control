import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, total, pageSize, onPage, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className={cn("flex items-center justify-between gap-3 px-1 py-2 text-xs text-muted-foreground", className)}>
      <span>{from}–{to} de {total}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={cn(
                "min-w-7 h-7 px-1 rounded-lg text-xs font-medium transition-colors",
                page === p
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
