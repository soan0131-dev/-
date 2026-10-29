import { QUALIFICATION_GRADE_LABELS } from "@/lib/format";

type EmployeeDates = {
  hireDate: Date;
  terminationDate: Date | null;
};

export type QualificationHeadcountRow = { grade: string; label: string; count: number };

/** 지정한 기준일 현재 재직중이었던 직원들의 자격 보유 현황을 집계한다. */
export function computeQualificationHeadcount(
  employees: (EmployeeDates & { qualificationGrades: string[] })[],
  asOfDate: Date
): QualificationHeadcountRow[] {
  const counts = new Map<string, number>();
  for (const grade of Object.keys(QUALIFICATION_GRADE_LABELS)) counts.set(grade, 0);

  for (const e of employees) {
    const employedAsOf = e.hireDate <= asOfDate && (!e.terminationDate || e.terminationDate > asOfDate);
    if (!employedAsOf) continue;
    for (const g of e.qualificationGrades) {
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }

  return Object.entries(QUALIFICATION_GRADE_LABELS).map(([grade, label]) => ({
    grade,
    label,
    count: counts.get(grade) ?? 0,
  }));
}

export type MonthlyTrendRow = {
  month: string;
  label: string;
  hires: number;
  exits: number;
  activeAtEnd: number;
};

/** 최근 N개월(기준월 포함)의 입사자/퇴사자/월말 재직인원 추이를 집계한다. */
export function computeMonthlyTrend(
  employees: EmployeeDates[],
  monthsBack: number,
  referenceDate: Date = new Date()
): MonthlyTrendRow[] {
  const rows: MonthlyTrendRow[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const monthEnd = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() - i + 1,
      0,
      23,
      59,
      59,
      999
    );

    let hires = 0;
    let exits = 0;
    let activeAtEnd = 0;

    for (const e of employees) {
      if (e.hireDate >= monthStart && e.hireDate <= monthEnd) hires++;
      if (e.terminationDate && e.terminationDate >= monthStart && e.terminationDate <= monthEnd) exits++;
      if (e.hireDate <= monthEnd && (!e.terminationDate || e.terminationDate > monthEnd)) activeAtEnd++;
    }

    rows.push({
      month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
      label: `${String(monthStart.getFullYear()).slice(2)}.${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
      hires,
      exits,
      activeAtEnd,
    });
  }

  return rows;
}
