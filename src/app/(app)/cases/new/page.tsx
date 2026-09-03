import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startCase } from "@/lib/workflow";
import type { JobGrade, PartnerType, QualificationGrade } from "@/generated/prisma/client";
import NewCaseForm from "./NewCaseForm";

async function requireHr() {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "HR")) {
    redirect("/");
  }
  return session;
}

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireHr();
  const params = await searchParams;

  const [branches, departments, activeEmployees] = await Promise.all([
    prisma.branch.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.department.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      include: { department: true },
      orderBy: { name: "asc" },
    }),
  ]);

  async function createOnboarding(formData: FormData) {
    "use server";
    const session = await requireHr();

    const name = (formData.get("name") as string)?.trim();
    const employeeNumber = (formData.get("employeeNumber") as string)?.trim();
    const departmentId = formData.get("departmentId") as string;
    const hireDateRaw = formData.get("hireDate") as string;
    const checklistType = formData.get("checklistType") as
      | "GENERAL"
      | "EXPERIENCED_CPA"
      | "SIMPLIFIED"
      | "";

    if (!name || !employeeNumber || !departmentId || !hireDateRaw || !checklistType) {
      redirect(
        `/cases/new?error=${encodeURIComponent(
          "이름, 부서, 입사(예정)일, 제출서류 체크리스트 유형은 필수 입력 항목입니다."
        )}`
      );
    }

    const jobGrade = ((formData.get("jobGrade") as string) || null) as JobGrade | null;
    const partnerType =
      jobGrade === "PARTNER" ? (((formData.get("partnerType") as string) || null) as PartnerType | null) : null;
    const qualificationGrades = formData.getAll("qualificationGrades") as QualificationGrade[];

    const employee = await prisma.employee.create({
      data: {
        name,
        employeeNumber,
        departmentId,
        jobGrade,
        partnerType,
        qualificationGrades,
        hireDate: new Date(hireDateRaw),
        email: (formData.get("email") as string) || null,
        phone: (formData.get("phone") as string) || null,
        status: "PENDING_ENTRY",
      },
    });

    const employeeCase = await startCase({
      employeeId: employee.id,
      type: "ONBOARDING",
      initiatedById: session.user.id,
      note: (formData.get("note") as string) || undefined,
      checklistType,
    });

    redirect(`/cases/${employeeCase.id}`);
  }

  async function createOffboarding(formData: FormData) {
    "use server";
    const session = await requireHr();

    const employeeId = formData.get("employeeId") as string;
    if (!employeeId) {
      redirect(`/cases/new?error=${encodeURIComponent("퇴사 대상 직원을 선택해주세요.")}`);
    }

    const reason = formData.get("reason") as string;
    const reasonDetail = (formData.get("reasonDetail") as string)?.trim();
    const reasonText = reason === "기타" && reasonDetail ? reasonDetail : reason;
    const note = (formData.get("note") as string)?.trim();

    const employeeCase = await startCase({
      employeeId,
      type: "OFFBOARDING",
      initiatedById: session.user.id,
      note: [reasonText, note].filter(Boolean).join(" · ") || undefined,
    });

    redirect(`/cases/${employeeCase.id}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">입퇴사 케이스 생성</h1>
      <NewCaseForm
        branches={branches}
        departments={departments}
        activeEmployees={activeEmployees.map((e) => ({
          id: e.id,
          name: e.name,
          employeeNumber: e.employeeNumber,
          departmentName: e.department.name,
        }))}
        createOnboarding={createOnboarding}
        createOffboarding={createOffboarding}
        errorMessage={params.error}
      />
    </div>
  );
}
