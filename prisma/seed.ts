import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, CaseType } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEPARTMENTS = [
  { code: "HR", name: "인사팀" },
  { code: "IT", name: "IT팀" },
  { code: "GA", name: "총무팀" },
  { code: "FIN", name: "재무팀" },
];

async function main() {
  const departments = new Map<string, string>();
  for (const dept of DEPARTMENTS) {
    const created = await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name },
      create: dept,
    });
    departments.set(dept.code, created.id);
  }

  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: "admin@bdo.kr" },
    update: {},
    create: {
      email: "admin@bdo.kr",
      passwordHash: adminPasswordHash,
      name: "시스템 관리자",
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "hr@bdo.kr" },
    update: {},
    create: {
      email: "hr@bdo.kr",
      passwordHash: adminPasswordHash,
      name: "인사담당자",
      role: "HR",
      departmentId: departments.get("HR"),
    },
  });

  for (const dept of DEPARTMENTS) {
    await prisma.user.upsert({
      where: { email: `${dept.code.toLowerCase()}.approver@bdo.kr` },
      update: {},
      create: {
        email: `${dept.code.toLowerCase()}.approver@bdo.kr`,
        passwordHash: adminPasswordHash,
        name: `${dept.name} 담당자`,
        role: "DEPT_APPROVER",
        departmentId: departments.get(dept.code),
      },
    });
  }

  // 입사 체크리스트: 1) 인사팀 선결재 -> 2) IT/총무/재무 병렬 확인 -> 3) 인사팀 최종 확인
  const onboardingTemplates = [
    { code: "HR", title: "근로계약서 확인 및 등록", group: 1, order: 1 },
    { code: "IT", title: "계정/장비 발급", group: 2, order: 1 },
    { code: "GA", title: "사원증 발급 및 좌석 배정", group: 2, order: 2 },
    { code: "FIN", title: "급여계좌 등록", group: 2, order: 3 },
    { code: "HR", title: "입사 서류 최종 확인", group: 3, order: 1 },
  ];

  // 퇴사 체크리스트: 1) 인사팀 사직서 접수 -> 2) IT/총무/재무 병렬 확인 -> 3) 인사팀 최종 확인
  const offboardingTemplates = [
    { code: "HR", title: "퇴사 서류(사직서) 접수", group: 1, order: 1 },
    { code: "IT", title: "계정/장비 회수", group: 2, order: 1 },
    { code: "GA", title: "사원증/비품 반납 확인", group: 2, order: 2 },
    { code: "FIN", title: "급여/퇴직금 정산", group: 2, order: 3 },
    { code: "HR", title: "퇴사 처리 최종 확인", group: 3, order: 1 },
  ];

  async function seedTemplates(
    type: CaseType,
    items: { code: string; title: string; group: number; order: number }[]
  ) {
    for (const item of items) {
      const existing = await prisma.caseStepTemplate.findFirst({
        where: { type, title: item.title, departmentId: departments.get(item.code) },
      });
      if (existing) continue;

      await prisma.caseStepTemplate.create({
        data: {
          type,
          title: item.title,
          sequenceGroup: item.group,
          displayOrder: item.order,
          departmentId: departments.get(item.code)!,
        },
      });
    }
  }

  await seedTemplates(CaseType.ONBOARDING, onboardingTemplates);
  await seedTemplates(CaseType.OFFBOARDING, offboardingTemplates);

  console.log("시드 데이터 생성 완료");
  console.log(`관리자 계정: admin@bdo.kr / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
