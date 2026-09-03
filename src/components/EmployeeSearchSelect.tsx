"use client";

import { useMemo, useState } from "react";

type Employee = { id: string; name: string; employeeNumber: string; departmentName: string };

export default function EmployeeSearchSelect({
  employees,
  name,
}: {
  employees: Employee[];
  name: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return employees
      .filter((e) => e.name.toLowerCase().includes(q) || e.employeeNumber.toLowerCase().includes(q))
      .slice(0, 20);
  }, [employees, query]);

  if (selected) {
    return (
      <div className="mt-1 flex items-center justify-between rounded-md border border-slate-300 px-2 py-1.5 text-sm">
        <span>
          {selected.name} ({selected.employeeNumber} · {selected.departmentName})
        </span>
        <input type="hidden" name={name} value={selected.id} />
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setQuery("");
          }}
          className="text-xs text-slate-500 hover:underline"
        >
          다시 선택
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="이름 또는 사번으로 검색"
        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      />
      {open && query.trim() && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-400">검색 결과가 없습니다.</li>
          )}
          {results.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => {
                  setSelected(e);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                {e.name} ({e.employeeNumber} · {e.departmentName})
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
