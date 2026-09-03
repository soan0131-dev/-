"use client";

import { useState } from "react";
import { JOB_GRADE_LABELS, PARTNER_TYPE_LABELS, QUALIFICATION_GRADE_LABELS } from "@/lib/format";

export default function JobGradeFields({
  defaultJobGrade,
  defaultPartnerType,
  defaultQualificationGrade,
}: {
  defaultJobGrade?: string | null;
  defaultPartnerType?: string | null;
  defaultQualificationGrade?: string | null;
}) {
  const [jobGrade, setJobGrade] = useState(defaultJobGrade ?? "");

  return (
    <>
      <div>
        <label className="block text-xs font-medium text-slate-500">직급</label>
        <select
          name="jobGrade"
          value={jobGrade}
          onChange={(e) => setJobGrade(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">선택안함</option>
          {Object.entries(JOB_GRADE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {jobGrade === "PARTNER" && (
        <div>
          <label className="block text-xs font-medium text-slate-500">파트너 유형</label>
          <select
            name="partnerType"
            defaultValue={defaultPartnerType ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">선택안함</option>
            {Object.entries(PARTNER_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-500">자격</label>
        <select
          name="qualificationGrade"
          defaultValue={defaultQualificationGrade ?? ""}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">선택안함</option>
          {Object.entries(QUALIFICATION_GRADE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
