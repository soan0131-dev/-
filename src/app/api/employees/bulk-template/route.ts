import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildCsv } from "@/lib/csv";
import { BULK_IMPORT_HEADERS } from "@/lib/bulkImport";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const exampleRow = [
    "홍길동",
    "2026001",
    "1010",
    "정규직",
    "담당",
    "",
    "KICPA(등록)",
    "1990-05-15",
    "2026-09-01",
    "hong@bdo.kr",
    "010-1234-5678",
    "준전문직",
  ];

  const csv = buildCsv(BULK_IMPORT_HEADERS, [exampleRow]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="employees_bulk_template.csv"`,
    },
  });
}
