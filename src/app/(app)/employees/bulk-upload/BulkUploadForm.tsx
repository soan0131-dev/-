"use client";

import { useActionState } from "react";
import type { BulkImportState } from "@/lib/bulkImport";

export default function BulkUploadForm({
  bulkImportAction,
}: {
  bulkImportAction: (prevState: BulkImportState, formData: FormData) => Promise<BulkImportState>;
}) {
  const [state, formAction, isPending] = useActionState(bulkImportAction, null);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
        <div>
          <label className="block text-xs font-medium text-slate-500">엑셀(CSV) 파일 선택</label>
          <input
            name="file"
            type="file"
            accept=".csv"
            required
            className="mt-1 block w-full text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {isPending ? "업로드 처리중..." : "일괄 등록 시작"}
        </button>
      </form>

      {state && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-900">
            총 {state.total}건 중 성공 {state.successCount}건, 실패 {state.failCount}건
          </p>
          {state.results.length > 0 && (
            <div className="mt-3 max-h-96 overflow-auto rounded-md border border-slate-100">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">행</th>
                    <th className="px-3 py-1.5 font-medium">이름</th>
                    <th className="px-3 py-1.5 font-medium">사번</th>
                    <th className="px-3 py-1.5 font-medium">결과</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.results.map((r, i) => (
                    <tr key={`${r.row}-${i}`} className={r.status === "error" ? "bg-red-50" : undefined}>
                      <td className="px-3 py-1.5 text-slate-500">{r.row || "-"}</td>
                      <td className="px-3 py-1.5">{r.name || "-"}</td>
                      <td className="px-3 py-1.5 text-slate-500">{r.employeeNumber || "-"}</td>
                      <td
                        className={`px-3 py-1.5 ${r.status === "error" ? "text-red-600" : "text-emerald-600"}`}
                      >
                        {r.status === "success" ? "등록완료" : r.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
