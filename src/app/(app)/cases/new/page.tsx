import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startCase } from "@/lib/workflow";
import NewCaseForm from "./NewCaseForm";

async function requireHr() {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "HR")) {
    redirect("/");
  }
  return session;
}

export default async function NewCasePage() {
  await requireHr();

  const [branches, departments, activeEmployees] = await Promise.all([
    prisma.branch.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      include: { department: true },
      orderBy: { name: "asc" },
    }),
  ]);

  async function createOnboarding(formData: FormData) {
    "use server";
    const session = await requireHr();

    const employee = await prisma.employee.create({
      data: {
        name: formData.get("name") as string,
        employeeNumber: formData.get("employeeNumber") as string,
        departmentId: formData.get("departmentId") as string,
        position: (formData.get("position") as string) || null,
        hireDate: new Date(formData.get("hireDate") as string),
        yearsOfExperience: Number(formData.get("yearsOfExperience") ?? 0),
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
      checklistType: formData.get("checklistType") as
        | "GENERAL"
        | "EXPERIENCED_CPA"
        | "SIMPLIFIED",
    });

    redirect(`/cases/${employeeCase.id}`);
  }

  async function createOffboarding(formData: FormData) {
    "use server";
    const session = await requireHr();

    const employeeId = formData.get("employeeId") as string;
    if (!employeeId) return;

    const employeeCase = await startCase({
      employeeId,
      type: "OFFBOARDING",
      initiatedById: session.user.id,
      note: (formData.get("note") as string) || undefined,
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
      />
    </div>
  );
}
