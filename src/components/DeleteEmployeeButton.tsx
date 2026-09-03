"use client";

export default function DeleteEmployeeButton({
  employeeName,
  deleteAction,
}: {
  employeeName: string;
  deleteAction: () => Promise<void>;
}) {
  return (
    <form
      action={deleteAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `${employeeName} 직원 정보를 삭제하시겠습니까?\n관련된 입퇴사 케이스, 서류, 결재 이력이 모두 함께 삭제되며 되돌릴 수 없습니다.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
      >
        직원 삭제
      </button>
    </form>
  );
}
