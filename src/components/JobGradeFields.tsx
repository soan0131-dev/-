"use client";

import { useState } from "react";
import { JOB_GRADE_LABELS, PARTNER_TYPE_LABELS, QUALIFICATION_GRADE_LABELS } from "@/lib/format";

export default function JobGradeFields({
  defaultJobGrade,
  defaultPartnerType,
  defaultQualificationGrades,
}: {
  defaultJobGrade?: string | null;
  defaultPartnerType?: string | null;
  defaultQualificationGrades?: string[];
}) {
  const [jobGrade, setJobGrade] = useState(defaultJobGrade ?? "");
  const checkedGrades = new Set(defaultQualificationGrades ?? []);
  const [kicpaChecked, setKicpaChecked] = useState(
    checkedGrades.has("KICPA_REGISTERED") || checkedGrades.has("KICPA_TRAINEE")
  );
  const [kicpaSubType, setKicpaSubType] = useState<"KICPA_REGISTERED" | "KICPA_TRAINEE">(
    checkedGrades.has("KICPA_TRAINEE") ? "KICPA_TRAINEE" : "KICPA_REGISTERED"
  );
  const otherGradeLabels = Object.entries(QUALIFICATION_GRADE_LABELS).filter(
    ([value]) => value !== "KICPA_REGISTERED" && value !== "KICPA_TRAINEE"
  );

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
      <div className="col-span-2">
        <label className="block text-xs font-medium text-slate-500">자격 (중복 선택 가능)</label>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-slate-300 p-2.5">
          <label className="flex items-center gap-1.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={kicpaChecked}
              onChange={(e) => setKicpaChecked(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            KICPA
          </label>
          {kicpaChecked && (
            <span className="flex items-center gap-3 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={kicpaSubType === "KICPA_REGISTERED"}
                  onChange={() => setKicpaSubType("KICPA_REGISTERED")}
                />
                등록
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={kicpaSubType === "KICPA_TRAINEE"}
                  onChange={() => setKicpaSubType("KICPA_TRAINEE")}
                />
                수습
              </label>
            </span>
          )}
          {kicpaChecked && <input type="hidden" name="qualificationGrades" value={kicpaSubType} />}
          {otherGradeLabels.map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                name="qualificationGrades"
                value={value}
                defaultChecked={checkedGrades.has(value)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
