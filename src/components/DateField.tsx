"use client";

import { useRef, useState } from "react";

/** 텍스트 직접 입력과 네이티브 달력 선택을 함께 지원하는 날짜 입력 필드 */
export default function DateField({
  name,
  label,
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const pickerRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className="block text-xs font-medium text-slate-500">{label}</label>
      <div className="relative mt-1">
        <input
          name={name}
          type="text"
          inputMode="numeric"
          required={required}
          placeholder="YYYY-MM-DD"
          pattern="\d{4}-\d{2}-\d{2}"
          title="YYYY-MM-DD 형식으로 입력해주세요"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 pr-9 text-sm"
        />
        <button
          type="button"
          onClick={() => pickerRef.current?.showPicker?.()}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400 hover:text-slate-600"
          aria-label="달력에서 날짜 선택"
        >
          📅
        </button>
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden
          value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""}
          onChange={(e) => setValue(e.target.value)}
          className="absolute h-0 w-0 opacity-0"
        />
      </div>
    </div>
  );
}
