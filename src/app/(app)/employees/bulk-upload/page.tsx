import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startCase } from "@/lib/workflow";
import { parseCsv } from "@/lib/csv";
import {
  BULK_IMPORT_HEADERS,
  BULK_IMPORT_MAX_ROWS,
  reverseLookup,
  type BulkImportRowResult,
  type BulkImportState,
} from "@/lib/bulkImport";
import { CHECKLIST_TYPE_LABELS } from "@/lib/documents";
import {
  CONTRACT_TYPE_LABELS,
  JOB_GRADE_LABELS,
  PARTNER_TYPE_LABELS,
  QUALIFICATION_GRADE_LABELS,
} from "@/lib/format";
import type {
  ContractType,
  DocumentChecklistType,
  JobGrade,
  PartnerType,
  QualificationGrade,
} from "@/generated/prisma/client";
import BulkUploadForm from "./BulkUploadForm";

async function requireHr() {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "HR")) {
    redirect("/");
  }
  return session;
}

function parseDateOrThrow(raw: string, label: string): Date | null {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`${label} 형식이 올바르지 않습니다 (YYYY-MM-DD).`);
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} 값이 올바르지 않습니다.`);
  }
  return date;
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
    return "이미 등록된 사번 또는 이메일입니다.";
  }
  return err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
}

export default async function BulkUploadPage() {
  await requireHr();

  async function bulkImportAction(
    _prevState: BulkImportState,
    formData: FormData
  ): Promise<BulkImportState> {
    "use server";
    const session = await requireHr();

    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return {
        total: 0,
        successCount: 0,
        failCount: 1,
        results: [{ row: 0, name: "", employeeNumber: "", status: "error", message: "파일을 선택해주세요." }],
      };
    }
    if (file.size > 5 * 1024 * 1024) {
      return {
        total: 0,
        successCount: 0,
        failCount: 1,
        results: [
          { row: 0, name: "", employeeNumber: "", status: "error", message: "파일 크기는 5MB를 초과할 수 없습니다." },
        ],
      };
    }

    const text = await file.text();
    const rows = parseCsv(text);
    const dataRows = rows.slice(1, 1 + BULK_IMPORT_MAX_ROWS);

    if (dataRows.length === 0) {
      return {
        total: 0,
        successCount: 0,
        failCount: 1,
        results: [
          {
            row: 0,
            name: "",
            employeeNumber: "",
            status: "error",
            message: "업로드할 데이터가 없습니다. 템플릿의 헤더 행 아래에 데이터를 입력해주세요.",
          },
        ],
      };
    }

    // 실제 조직도에 배치 가능한 부서만 대상으로 함 (인사팀/IT팀 등 결재 라우팅 전용 부서는 제외)
    const departments = await prisma.department.findMany({ where: { branchId: { not: null } } });
    const deptByCode = new Map(departments.map((d) => [d.code, d]));

    const results: BulkImportRowResult[] = [];
    let successCount = 0;

    for (let idx = 0; idx < dataRows.length; idx++) {
      const rowNum = idx + 2; // 1행은 헤더
      const cols = dataRows[idx];
      const [
        name,
        employeeNumber,
        deptCode,
        contractTypeLabel,
        jobGradeLabel,
        partnerTypeLabel,
        qualificationsLabel,
        birthDateRaw,
        hireDateRaw,
        email,
        phone,
        checklistTypeLabel,
      ] = BULK_IMPORT_HEADERS.map((_, i) => (cols[i] ?? "").trim());

      try {
        if (!name || !employeeNumber || !deptCode || !hireDateRaw || !checklistTypeLabel) {
          throw new Error("이름/사번/부서코드/입사일/제출서류체크리스트유형은 필수입니다.");
        }

        const department = deptByCode.get(deptCode);
        if (!department) throw new Error(`부서코드 '${deptCode}'를 찾을 수 없습니다.`);

        const contractType = contractTypeLabel
          ? reverseLookup(CONTRACT_TYPE_LABELS, contractTypeLabel)
          : "REGULAR";
        if (!contractType) throw new Error(`계약형태 '${contractTypeLabel}' 값을 인식할 수 없습니다.`);

        let jobGrade: string | null = null;
        if (jobGradeLabel) {
          const matched = reverseLookup(JOB_GRADE_LABELS, jobGradeLabel);
          if (!matched) throw new Error(`직급 '${jobGradeLabel}' 값을 인식할 수 없습니다.`);
          jobGrade = matched;
        }

        let partnerType: string | null = null;
        if (jobGrade === "PARTNER" && partnerTypeLabel) {
          const matched = reverseLookup(PARTNER_TYPE_LABELS, partnerTypeLabel);
          if (!matched) throw new Error(`파트너유형 '${partnerTypeLabel}' 값을 인식할 수 없습니다.`);
          partnerType = matched;
        }

        const qualificationGrades: string[] = [];
        if (qualificationsLabel) {
          for (const label of qualificationsLabel.split(";").map((s) => s.trim()).filter(Boolean)) {
            const matched = reverseLookup(QUALIFICATION_GRADE_LABELS, label);
            if (!matched) throw new Error(`자격 '${label}' 값을 인식할 수 없습니다.`);
            qualificationGrades.push(matched);
          }
        }

        const checklistType = reverseLookup(CHECKLIST_TYPE_LABELS, checklistTypeLabel);
        if (!checklistType) {
          throw new Error(`제출서류체크리스트유형 '${checklistTypeLabel}' 값을 인식할 수 없습니다.`);
        }

        const birthDate = parseDateOrThrow(birthDateRaw, "생년월일");
        const hireDate = parseDateOrThrow(hireDateRaw, "입사일") as Date;

        const employee = await prisma.employee.create({
          data: {
            name,
            employeeNumber,
            departmentId: department.id,
            contractType: contractType as ContractType,
            jobGrade: jobGrade as JobGrade | null,
            partnerType: partnerType as PartnerType | null,
            qualificationGrades: qualificationGrades as QualificationGrade[],
            birthDate,
            hireDate,
            email: email || null,
            phone: phone || null,
            status: "PENDING_ENTRY",
          },
        });

        await startCase({
          employeeId: employee.id,
          type: "ONBOARDING",
          initiatedById: session.user.id,
          checklistType: checklistType as DocumentChecklistType,
        });

        results.push({ row: rowNum, name, employeeNumber, status: "success" });
        successCount++;
      } catch (err) {
        results.push({ row: rowNum, name, employeeNumber, status: "error", message: errorMessage(err) });
      }
    }

    revalidatePath("/employees");

    return { total: dataRows.length, successCount, failCount: dataRows.length - successCount, results };
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/employees" className="text-sm text-slate-500 hover:underline">
          ← 전직원 현황판으로 돌아가기
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">입사자 일괄 등록 (엑셀 업로드)</h1>
        <p className="mt-1 text-sm text-slate-500">
          템플릿을 다운로드해 양식에 맞게 작성한 뒤 업로드하면, 행마다 새 직원과 입사 케이스가 한 번에
          생성됩니다. 한 번에 최대 {BULK_IMPORT_MAX_ROWS.toLocaleString()}건까지 처리할 수 있습니다.
        </p>
      </div>

      <a
        href="/api/employees/bulk-template"
        className="inline-block rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        템플릿(CSV) 다운로드
      </a>

      <BulkUploadForm bulkImportAction={bulkImportAction} />
    </div>
  );
}
