import { prisma } from "@/lib/prisma";
import {
  CaseStatus,
  CaseType,
  EmployeeStatus,
  StepStatus,
} from "@/generated/prisma/client";

/**
 * 입퇴사 케이스 시작: 활성 템플릿을 복사해 CaseStep을 생성하고
 * 가장 낮은 sequenceGroup을 ACTIVE로 전환한다. 이후 그룹은 이전 그룹이
 * 모두 승인될 때까지 PENDING 상태로 대기한다.
 */
export async function startCase(params: {
  employeeId: string;
  type: CaseType;
  initiatedById: string;
  note?: string;
}) {
  const { employeeId, type, initiatedById, note } = params;

  const templates = await prisma.caseStepTemplate.findMany({
    where: { type, isActive: true },
    orderBy: [{ sequenceGroup: "asc" }, { displayOrder: "asc" }],
  });

  if (templates.length === 0) {
    throw new Error(
      "활성화된 체크리스트 템플릿이 없습니다. 관리자 화면에서 먼저 템플릿을 등록하세요."
    );
  }

  const firstGroup = Math.min(...templates.map((t) => t.sequenceGroup));

  return prisma.$transaction(async (tx) => {
    const employeeCase = await tx.employeeCase.create({
      data: {
        type,
        status: CaseStatus.IN_PROGRESS,
        note,
        employeeId,
        initiatedById,
        steps: {
          create: templates.map((t) => ({
            title: t.title,
            description: t.description,
            sequenceGroup: t.sequenceGroup,
            displayOrder: t.displayOrder,
            departmentId: t.departmentId,
            status: t.sequenceGroup === firstGroup ? StepStatus.ACTIVE : StepStatus.PENDING,
          })),
        },
      },
      include: { steps: true },
    });

    await tx.employee.update({
      where: { id: employeeId },
      data: {
        status:
          type === CaseType.ONBOARDING
            ? EmployeeStatus.PENDING_ENTRY
            : EmployeeStatus.PENDING_EXIT,
      },
    });

    await notifyStepApprovers(
      tx,
      employeeCase.steps.filter((s) => s.status === StepStatus.ACTIVE),
      employeeCase.id
    );

    await tx.auditLog.create({
      data: {
        actorId: initiatedById,
        action: "CASE_STARTED",
        targetType: "EmployeeCase",
        targetId: employeeCase.id,
        detail: `type=${type}`,
      },
    });

    return employeeCase;
  });
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function notifyStepApprovers(
  tx: Tx,
  steps: { id: string; departmentId: string; title: string; caseId: string }[],
  caseId: string
) {
  for (const step of steps) {
    const approvers = await tx.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: "ADMIN" },
          { role: "DEPT_APPROVER", departmentId: step.departmentId },
          { role: "HR", departmentId: step.departmentId },
        ],
      },
      select: { id: true },
    });

    if (approvers.length === 0) continue;

    await tx.notification.createMany({
      data: approvers.map((a) => ({
        userId: a.id,
        message: `승인 대기 항목이 있습니다: ${step.title}`,
        link: `/cases/${caseId}`,
      })),
    });
  }
}

/** 로그인 사용자가 해당 스텝을 승인/반려할 권한이 있는지 확인 */
export function canActOnStep(
  user: { role: string; departmentId: string | null },
  step: { departmentId: string }
) {
  if (user.role === "ADMIN") return true;
  // HR 역할은 인사팀 스텝에 한해 부서담당자와 동일하게 승인 권한을 가진다.
  if (user.role === "DEPT_APPROVER" || user.role === "HR") {
    return user.departmentId === step.departmentId;
  }
  return false;
}

/**
 * 스텝 승인 처리. 같은 sequenceGroup 내 모든 스텝이 승인되면 다음 그룹을
 * 활성화하고, 더 이상 그룹이 없으면 케이스를 완료 처리하며 Employee 마스터
 * 상태를 갱신한다.
 */
export async function approveStep(params: {
  stepId: string;
  approverId: string;
  comment?: string;
}) {
  const { stepId, approverId, comment } = params;

  return prisma.$transaction(async (tx) => {
    const step = await tx.caseStep.findUniqueOrThrow({
      where: { id: stepId },
      include: { case: true },
    });

    if (step.status !== StepStatus.ACTIVE) {
      throw new Error("현재 확인 대기 상태가 아닌 항목입니다.");
    }

    await tx.caseStep.update({
      where: { id: stepId },
      data: {
        status: StepStatus.APPROVED,
        approvedById: approverId,
        approvedAt: new Date(),
        comment,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: approverId,
        action: "STEP_APPROVED",
        targetType: "CaseStep",
        targetId: stepId,
        detail: comment,
      },
    });

    const remainingInGroup = await tx.caseStep.count({
      where: {
        caseId: step.caseId,
        sequenceGroup: step.sequenceGroup,
        status: { not: StepStatus.APPROVED },
      },
    });

    if (remainingInGroup > 0) {
      return { caseCompleted: false };
    }

    const nextGroupSteps = await tx.caseStep.findMany({
      where: {
        caseId: step.caseId,
        sequenceGroup: { gt: step.sequenceGroup },
      },
      orderBy: { sequenceGroup: "asc" },
    });

    if (nextGroupSteps.length > 0) {
      const nextGroup = Math.min(...nextGroupSteps.map((s) => s.sequenceGroup));
      const toActivate = nextGroupSteps.filter((s) => s.sequenceGroup === nextGroup);

      await tx.caseStep.updateMany({
        where: { id: { in: toActivate.map((s) => s.id) } },
        data: { status: StepStatus.ACTIVE },
      });

      await notifyStepApprovers(tx, toActivate, step.caseId);

      return { caseCompleted: false };
    }

    // 모든 그룹 완료 -> 케이스 완료 및 Employee 마스터 갱신
    const updatedCase = await tx.employeeCase.update({
      where: { id: step.caseId },
      data: { status: CaseStatus.COMPLETED, completedAt: new Date() },
    });

    await tx.employee.update({
      where: { id: updatedCase.employeeId },
      data: {
        status:
          updatedCase.type === CaseType.ONBOARDING
            ? EmployeeStatus.ACTIVE
            : EmployeeStatus.TERMINATED,
        ...(updatedCase.type === CaseType.OFFBOARDING
          ? { terminationDate: new Date() }
          : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: approverId,
        action: "CASE_COMPLETED",
        targetType: "EmployeeCase",
        targetId: step.caseId,
      },
    });

    return { caseCompleted: true };
  });
}

/** 스텝 반려: 해당 케이스 전체를 REJECTED로 전환하고 케이스 담당자에게 알린다. */
export async function rejectStep(params: {
  stepId: string;
  approverId: string;
  comment: string;
}) {
  const { stepId, approverId, comment } = params;

  return prisma.$transaction(async (tx) => {
    const step = await tx.caseStep.findUniqueOrThrow({
      where: { id: stepId },
      include: { case: true },
    });

    if (step.status !== StepStatus.ACTIVE) {
      throw new Error("현재 확인 대기 상태가 아닌 항목입니다.");
    }

    await tx.caseStep.update({
      where: { id: stepId },
      data: { status: StepStatus.REJECTED, approvedById: approverId, approvedAt: new Date(), comment },
    });

    await tx.employeeCase.update({
      where: { id: step.caseId },
      data: { status: CaseStatus.REJECTED },
    });

    await tx.notification.create({
      data: {
        userId: step.case.initiatedById,
        message: `${step.title} 항목이 반려되었습니다: ${comment}`,
        link: `/cases/${step.caseId}`,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: approverId,
        action: "STEP_REJECTED",
        targetType: "CaseStep",
        targetId: stepId,
        detail: comment,
      },
    });
  });
}

/**
 * 반려된 케이스를 재오픈: 반려된 스텝을 다시 ACTIVE로 돌리고 케이스를
 * IN_PROGRESS로 되돌린다 (HR/관리자가 보완 후 사용).
 */
export async function reopenCase(params: { caseId: string; actorId: string }) {
  const { caseId, actorId } = params;

  return prisma.$transaction(async (tx) => {
    const rejectedStep = await tx.caseStep.findFirst({
      where: { caseId, status: StepStatus.REJECTED },
      orderBy: { sequenceGroup: "asc" },
    });

    if (!rejectedStep) {
      throw new Error("반려된 항목이 없어 재오픈할 수 없습니다.");
    }

    await tx.caseStep.update({
      where: { id: rejectedStep.id },
      data: { status: StepStatus.ACTIVE, comment: null, approvedById: null, approvedAt: null },
    });

    await tx.employeeCase.update({
      where: { id: caseId },
      data: { status: CaseStatus.IN_PROGRESS },
    });

    await notifyStepApprovers(tx, [rejectedStep], caseId);

    await tx.auditLog.create({
      data: {
        actorId,
        action: "CASE_REOPENED",
        targetType: "EmployeeCase",
        targetId: caseId,
      },
    });
  });
}
