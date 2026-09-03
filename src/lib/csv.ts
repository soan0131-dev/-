function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(","));
  // BOM을 붙여야 Excel(Windows)에서 UTF-8 한글이 깨지지 않고 표시됨
  return "﻿" + lines.join("\r\n");
}
