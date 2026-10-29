import type { QualificationHeadcountRow } from "@/lib/dashboardStats";

const SERIES_BLUE = "#2a78d6";

export default function QualificationHeadcountBars({ rows }: { rows: QualificationHeadcountRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.grade} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs text-slate-600">{r.label}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-sm bg-slate-100">
            <div
              className="h-5 rounded-r-[4px]"
              style={{ width: `${(r.count / max) * 100}%`, backgroundColor: SERIES_BLUE }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-sm font-medium tabular-nums text-slate-900">
            {r.count}
          </span>
        </div>
      ))}
    </div>
  );
}
