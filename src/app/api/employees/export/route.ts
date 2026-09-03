import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildCsv } from "@/lib/csv";
import {
  CONTRACT_TYPE_LABELS,
  EMPLOYEE_STATUS_LABELS,
  JOB_GRADE_LABELS,
  PARTNER_TYPE_LABELS,
  QUALIFICATION_GRADE_LABELS,
  formatDate,
} from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const branchId = url.searchParams.get("branchId");
  const departmentId = url.searchParams.get("departmentId");
  const status = url.searchParams.get("status");
  const qualification = url.searchParams.get("qualification");

  const where: Prisma.EmployeeWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { employeeNumber: { contains: q, mode: "insensitive" } },
    ];
  }
  if (departmentId) {
    where.departmentId = departmentId;
  } else if (branchId) {
    where.department = { branchId };
  }
  if (status) {
    where.status = status as Prisma.EnumEmployeeStatusFilter["equals"];
  }
  if (qualification) {
    where.qualifications = {
      some: { name: { contains: qualification, mode: "insensitive" } },
    };
  }

  const employees = await prisma.employee.findMany({
    where,
    include: {
      department: { include: { branch: true } },
      qualifications: { orderBy: { acquiredDate: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  const headers = [
    "이름",
    "사번",
    "본/지사",
    "부서",
    "부서코드",
    "직급",
    "파트너유형",
    "자격",
    "계약형태",
    "재직상태",
    "입사일",
    "퇴사일",
    "사내이메일",
    "개인이메일",
    "연락처",
    "보유자격(등록번호/취득일)",
  ];

  const rows = employees.map((e) => [
    e.name,
    e.employeeNumber,
    e.department.branch?.name ?? "",
    e.department.name,
    e.department.code,
    e.jobGrade ? JOB_GRADE_LABELS[e.jobGrade] : "",
    e.partnerType ? PARTNER_TYPE_LABELS[e.partnerType] : "",
    e.qualificationGrades.map((g) => QUALIFICATION_GRADE_LABELS[g]).join("; "),
    CONTRACT_TYPE_LABELS[e.contractType],
    EMPLOYEE_STATUS_LABELS[e.status],
    formatDate(e.hireDate),
    formatDate(e.terminationDate),
    e.email ?? "",
    e.personalEmail ?? "",
    e.phone ?? "",
    e.qualifications
      .map((q) => `${q.name}(${q.registrationNumber ?? "-"}/${formatDate(q.acquiredDate)})`)
      .join("; "),
  ]);

  const csv = buildCsv(headers, rows);
  const filename = `employees_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
