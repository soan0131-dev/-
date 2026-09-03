"use client";

import { useState } from "react";
import { CHECKLIST_TYPE_LABELS } from "@/lib/documents";
import JobGradeFields from "@/components/JobGradeFields";

type Branch = { id: string; name: string };
type Department = { id: string; name: string; branchId: string | null };
type Employee = { id: string; name: string; employeeNumber: string; departmentName: string };

export default function NewCaseForm({
  branches,
  departments,
  activeEmployees,
  createOnboarding,
  createOffboarding,
  errorMessage,
}: {
  branches: Branch[];
  departments: Department[];
  activeEmployees: Employee[];
  createOnboarding: (formData: FormData) => Promise<void>;
  createOffboarding: (formData: FormData) => Promise<void>;
  errorMessage?: string;
}) {
  const [mode, setMode] = useState<"ONBOARDING" | "OFFBOARDING">("ONBOARDING");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const departmentsInBranch = departments.filter((d) => d.branchId === branchId);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("ONBOARDING")}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            mode === "ONBOARDING" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"
          }`}
        >
          입사자 등록
        </button>
        <button
          type="button"
          onClick={() => setMode("OFFBOARDING")}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            mode === "OFFBOARDING" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"
          }`}
        >
          퇴사자 처리
        </button>
      </div>

      {errorMessage && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
      )}

      {mode === "ONBOARDING" ? (
        <form action={createOnboarding} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="grid grid-cols-2 gap-4">
            <TextField name="name" label="이름" required />
            <TextField name="employeeNumber" label="사번" required />
            <div>
              <label className="block text-xs font-medium text-slate-500">본/지사</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">부서</label>
              <select
                key={branchId}
                name="departmentId"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                {departmentsInBranch.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <JobGradeFields />
            <TextField name="hireDate" label="입사(예정)일" type="date" required />
            <TextField name="yearsOfExperience" label="경력연수(입사 전)" type="number" defaultValue="0" />
            <TextField name="email" label="사내 이메일" type="email" />
            <TextField name="phone" label="연락처" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">제출서류 체크리스트 유형</label>
            <select
              name="checklistType"
              required
              defaultValue="GENERAL"
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {Object.entries(CHECKLIST_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <TextArea name="note" label="비고" />
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            입사 케이스 시작
          </button>
        </form>
      ) : (
        <form action={createOffboarding} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <label className="block text-xs font-medium text-slate-500">퇴사 대상 직원</label>
            <select name="employeeId" required className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">선택하세요</option>
              {activeEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.employeeNumber} · {e.departmentName})
                </option>
              ))}
            </select>
          </div>
          <TextArea name="note" label="퇴사 사유/비고" />
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            퇴사 케이스 시작
          </button>
        </form>
      )}
    </div>
  );
}

function TextField({
  name,
  label,
  type = "text",
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      />
    </div>
  );
}

function TextArea({ name, label }: { name: string; label: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500">{label}</label>
      <textarea name={name} rows={2} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
    </div>
  );
}
