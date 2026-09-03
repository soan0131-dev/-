import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, CaseType } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// 결재 라우팅 전용 부서 (실제 조직도가 아닌, 입퇴사 체크리스트의 확인 주체)
const DEPARTMENTS = [
  { code: "HR", name: "인사팀" },
  { code: "IT", name: "IT팀" },
  { code: "GA", name: "총무팀" },
  { code: "FIN", name: "재무팀" },
];

// 실제 조직도: 본/지사 + 소속 부서 (부서코드 기준)
const REAL_ORG = [
  { branch: "서울본사", code: "1010", name: "법인 대표실" },
  { branch: "서울본사", code: "1020", name: "법인 품질관리실" },
  { branch: "서울본사", code: "1025", name: "법인 품질관리(DA)" },
  { branch: "서울본사", code: "1030", name: "법인공통" },
  { branch: "서울본사", code: "1040", name: "법인 ESG" },
  { branch: "서울본사", code: "1050", name: "법인 포렌식" },
  { branch: "서울본사", code: "1060", name: "법인 금융본부1" },
  { branch: "서울본사", code: "1061", name: "법인 금융본부2" },
  { branch: "서울본사", code: "1080", name: "법인 국제조세" },
  { branch: "서울본사", code: "1095", name: "법인 재무" },
  { branch: "서울본사", code: "1110", name: "서울1감사1" },
  { branch: "서울본사", code: "1120", name: "서울1FAS1" },
  { branch: "서울본사", code: "1130", name: "서울1BSO1" },
  { branch: "서울본사", code: "1140", name: "서울1공통1" },
  { branch: "서울본사", code: "1150", name: "서울1감사2" },
  { branch: "서울본사", code: "1170", name: "서울1기업금융4" },
  { branch: "서울본사", code: "1210", name: "서울2세무" },
  { branch: "서울본사", code: "1220", name: "서울2Global Risk관리팀" },
  { branch: "서울본사", code: "1240", name: "서울2공통" },
  { branch: "서울본사", code: "1250", name: "서울2회계" },
  { branch: "서울본사", code: "1260", name: "서울2PS" },
  { branch: "서울본사", code: "1510", name: "서울4감사1-1" },
  { branch: "서울본사", code: "1520", name: "서울4감사1-2" },
  { branch: "서울본사", code: "1530", name: "서울4감사1-3" },
  { branch: "서울본사", code: "1540", name: "서울4공통1" },
  { branch: "서울본사", code: "1555", name: "서울4감사5" },
  { branch: "서울본사", code: "1556", name: "서울4감사3" },
  { branch: "서울본사", code: "1571", name: "서울4세무2" },
  { branch: "서울본사", code: "1579", name: "서울4공통2" },
  { branch: "서울본사", code: "1590", name: "서울4감사4" },
  { branch: "서울본사", code: "1710", name: "서울6감사1" },
  { branch: "서울본사", code: "1740", name: "서울6감사2" },
  { branch: "서울본사", code: "1810", name: "해성BSO" },
  { branch: "서울본사", code: "2910", name: "서울경영기획본부" },
  { branch: "부산지사", code: "3110", name: "부산1감사" },
  { branch: "부산지사", code: "3120", name: "부산1세무" },
  { branch: "부산지사", code: "3130", name: "부산1공통" },
  { branch: "대구지사", code: "4110", name: "대구1감사" },
  { branch: "대구지사", code: "4120", name: "대구1세무1" },
  { branch: "대구지사", code: "4130", name: "대구1세무2" },
  { branch: "창원지사", code: "5110", name: "창원1감사" },
  { branch: "창원지사", code: "5120", name: "창원1세무" },
  { branch: "창원지사", code: "5130", name: "창원1공통" },
];

const BRANCHES = ["서울본사", "부산지사", "대구지사", "창원지사"];

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

  const branchIds = new Map<string, string>();
  for (const [index, name] of BRANCHES.entries()) {
    const created = await prisma.branch.upsert({
      where: { name },
      update: { displayOrder: index },
      create: { name, displayOrder: index },
    });
    branchIds.set(name, created.id);
  }

  for (const [index, org] of REAL_ORG.entries()) {
    await prisma.department.upsert({
      where: { code: org.code },
      update: { name: org.name, branchId: branchIds.get(org.branch), displayOrder: index },
      create: {
        code: org.code,
        name: org.name,
        branchId: branchIds.get(org.branch),
        displayOrder: index,
      },
    });
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
