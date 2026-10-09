/** Page numbers to show: always first and last, plus a window around the current page. */
function pageList(page: number, pages: number): (number | "gap")[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  // Fill a gap of exactly one page instead of showing "…" for it.
  if (keep.has(3) && pages > 3) keep.add(2);
  if (keep.has(pages - 2) && pages > 3) keep.add(pages - 1);
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  disabled,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav aria-label="Pagination" className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p className="text-xs text-muted tabular-nums order-2 sm:order-1">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <PageButton disabled={disabled || page <= 1} onClick={() => onChange(page - 1)} label="Previous page">
          ← <span className="hidden sm:inline">Prev</span>
        </PageButton>

        {/* Phones: compact position. Larger screens: numbered pages. */}
        <span className="sm:hidden px-3 text-sm tabular-nums">
          Page {page} of {pages}
        </span>
        <div className="hidden sm:flex items-center gap-1">
          {pageList(page, pages).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-muted" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                disabled={disabled}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={`min-w-9 h-9 px-2 rounded-lg text-sm tabular-nums transition-colors ${
                  p === page
                    ? "bg-accent text-white font-semibold"
                    : "text-muted hover:text-foreground hover:bg-surface-2"
                }`}
              >
                {p}
              </button>
            ),
          )}
        </div>

        <PageButton disabled={disabled || page >= pages} onClick={() => onChange(page + 1)} label="Next page">
          <span className="hidden sm:inline">Next</span> →
        </PageButton>
      </div>
    </nav>
  );
}

function PageButton({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="h-9 px-3 rounded-lg text-sm border border-border text-muted hover:text-foreground hover:border-muted transition-colors disabled:opacity-40 disabled:hover:text-muted disabled:hover:border-border"
    >
      {children}
    </button>
  );
}
