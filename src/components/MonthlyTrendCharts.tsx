"use client";

import { useId, useState } from "react";
import type { MonthlyTrendRow } from "@/lib/dashboardStats";

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const GRID = "#e1e0d9";
const AXIS_TEXT = "#898781";

const WIDTH = 720;
const HEIGHT = 170;
const PAD_LEFT = 32;
const PAD_RIGHT = 12;
const PAD_TOP = 24;
const PAD_BOTTOM = 24;

export default function MonthlyTrendCharts({ rows }: { rows: MonthlyTrendRow[] }) {
  return (
    <div className="space-y-8">
      <ActiveTrendChart rows={rows} />
      <FlowBarChart rows={rows} />
    </div>
  );
}

function monthX(i: number, count: number) {
  const innerWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  if (count <= 1) return PAD_LEFT + innerWidth / 2;
  return PAD_LEFT + (innerWidth * i) / (count - 1);
}

function ActiveTrendChart({ rows }: { rows: MonthlyTrendRow[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId();

  const max = Math.max(1, ...rows.map((r) => r.activeAtEnd));
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const y = (v: number) => PAD_TOP + innerHeight - (v / max) * innerHeight;

  const points = rows.map((r, i) => [monthX(i, rows.length), y(r.activeAtEnd)] as const);
  const linePath = points.map(([x, py], i) => `${i === 0 ? "M" : "L"}${x},${py}`).join(" ");
  const areaPath =
    `M${points[0][0]},${PAD_TOP + innerHeight} ` +
    points.map(([x, py]) => `L${x},${py}`).join(" ") +
    ` L${points[points.length - 1][0]},${PAD_TOP + innerHeight} Z`;

  const last = rows[rows.length - 1];

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const idx = Math.min(rows.length - 1, Math.max(0, Math.round(ratio * (rows.length - 1))));
    setHover(idx);
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">월말 재직인원 추이 (최근 {rows.length}개월)</h3>
      <div className="relative mt-2">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="월말 재직인원 추이 차트">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BLUE} stopOpacity={0.12} />
              <stop offset="100%" stopColor={BLUE} stopOpacity={0.12} />
            </linearGradient>
          </defs>
          <line
            x1={PAD_LEFT}
            y1={PAD_TOP + innerHeight}
            x2={WIDTH - PAD_RIGHT}
            y2={PAD_TOP + innerHeight}
            stroke={GRID}
            strokeWidth={1}
          />
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path d={linePath} fill="none" stroke={BLUE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map(([x, py], i) => (
            <circle key={i} cx={x} cy={py} r={i === points.length - 1 ? 4.5 : 2.5} fill={BLUE} stroke="#fff" strokeWidth={2} />
          ))}
          {rows.map((r, i) => (
            <text key={r.month} x={monthX(i, rows.length)} y={HEIGHT - 6} fontSize={10} fill={AXIS_TEXT} textAnchor="middle">
              {i % 2 === 0 || rows.length <= 7 ? r.label : ""}
            </text>
          ))}
          <text x={points[points.length - 1][0]} y={Math.max(10, points[points.length - 1][1] - 10)} fontSize={11} fontWeight={600} fill="#0b0b0b" textAnchor="end">
            {last.activeAtEnd}명
          </text>
          {hover !== null && (
            <line
              x1={monthX(hover, rows.length)}
              y1={PAD_TOP}
              x2={monthX(hover, rows.length)}
              y2={PAD_TOP + innerHeight}
              stroke={AXIS_TEXT}
              strokeWidth={1}
            />
          )}
          <rect
            x={PAD_LEFT}
            y={PAD_TOP}
            width={WIDTH - PAD_LEFT - PAD_RIGHT}
            height={innerHeight}
            fill="transparent"
            onMouseMove={handleMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm"
            style={{ left: `${(monthX(hover, rows.length) / WIDTH) * 100}%` }}
          >
            <p className="font-medium text-slate-900">{rows[hover].label}</p>
            <p className="text-slate-500">
              재직인원 <span className="font-semibold tabular-nums text-slate-900">{rows[hover].activeAtEnd}</span>명
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function FlowBarChart({ rows }: { rows: MonthlyTrendRow[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...rows.map((r) => Math.max(r.hires, r.exits)));
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const bandWidth = (WIDTH - PAD_LEFT - PAD_RIGHT) / rows.length;
  const barWidth = Math.min(16, bandWidth / 2 - 4);
  const baselineY = PAD_TOP + innerHeight;
  const barHeight = (v: number) => (v / max) * innerHeight;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">월별 입사/퇴사 인원</h3>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BLUE }} />
            입사
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ORANGE }} />
            퇴사
          </span>
        </div>
      </div>
      <div className="relative mt-2">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="월별 입사/퇴사 인원 차트">
          <line x1={PAD_LEFT} y1={baselineY} x2={WIDTH - PAD_RIGHT} y2={baselineY} stroke={GRID} strokeWidth={1} />
          {rows.map((r, i) => {
            const groupX = PAD_LEFT + bandWidth * i + bandWidth / 2;
            const hiresH = barHeight(r.hires);
            const exitsH = barHeight(r.exits);
            return (
              <g key={r.month}>
                <rect
                  x={groupX - barWidth - 1}
                  y={baselineY - hiresH}
                  width={barWidth}
                  height={Math.max(hiresH, 1)}
                  rx={3}
                  fill={BLUE}
                  opacity={hover === i || hover === null ? 1 : 0.35}
                />
                <rect
                  x={groupX + 1}
                  y={baselineY - exitsH}
                  width={barWidth}
                  height={Math.max(exitsH, 1)}
                  rx={3}
                  fill={ORANGE}
                  opacity={hover === i || hover === null ? 1 : 0.35}
                />
                <text x={groupX} y={HEIGHT - 6} fontSize={10} fill={AXIS_TEXT} textAnchor="middle">
                  {i % 2 === 0 || rows.length <= 7 ? r.label : ""}
                </text>
                <rect
                  x={PAD_LEFT + bandWidth * i}
                  y={PAD_TOP}
                  width={bandWidth}
                  height={innerHeight}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm"
            style={{ left: `${((PAD_LEFT + bandWidth * hover + bandWidth / 2) / WIDTH) * 100}%` }}
          >
            <p className="font-medium text-slate-900">{rows[hover].label}</p>
            <p className="text-slate-600">
              입사 <span className="font-semibold tabular-nums text-slate-900">{rows[hover].hires}</span>명 · 퇴사{" "}
              <span className="font-semibold tabular-nums text-slate-900">{rows[hover].exits}</span>명
            </p>
          </div>
        )}
      </div>

      <details className="mt-3 text-xs text-slate-500">
        <summary className="cursor-pointer select-none hover:text-slate-700">표로 보기</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-4 font-medium">월</th>
                <th className="py-1 pr-4 font-medium">입사</th>
                <th className="py-1 pr-4 font-medium">퇴사</th>
                <th className="py-1 pr-4 font-medium">월말 재직인원</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="border-t border-slate-100">
                  <td className="py-1 pr-4 tabular-nums">{r.label}</td>
                  <td className="py-1 pr-4 tabular-nums">{r.hires}</td>
                  <td className="py-1 pr-4 tabular-nums">{r.exits}</td>
                  <td className="py-1 pr-4 tabular-nums">{r.activeAtEnd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
