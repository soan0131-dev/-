"""입퇴사자 명단 파일(CSV / XLSX) 읽기."""
from __future__ import annotations

import csv
import io
from pathlib import Path
from typing import Any

# 인코딩 미지정 시 시도 순서: Excel "CSV UTF-8" → 한글 Windows 기본(CP949)
DEFAULT_CSV_ENCODINGS = ("utf-8-sig", "cp949")


class InputError(Exception):
    """명단 파일을 읽을 수 없는 경우."""


Row = dict[str, Any]


def read_table(path: Path, encoding: str | None = None, sheet: str | None = None) -> tuple[list[str], list[Row]]:
    """파일을 읽어 (헤더 목록, 행 목록)을 반환한다. 각 행은 {헤더: 값} 딕셔너리."""
    if not path.is_file():
        raise InputError(f"명단 파일을 찾을 수 없습니다: {path}")
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return _read_csv(path, encoding)
    if suffix in (".xlsx", ".xlsm"):
        return _read_xlsx(path, sheet)
    raise InputError(f"지원하지 않는 파일 형식입니다: {suffix} (.csv, .xlsx 만 지원)")


def _decode(data: bytes, encoding: str | None) -> str:
    candidates = (encoding,) if encoding else DEFAULT_CSV_ENCODINGS
    for enc in candidates:
        try:
            return data.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    raise InputError(f"CSV 인코딩을 해석할 수 없습니다 (시도: {', '.join(candidates)})")


def _read_csv(path: Path, encoding: str | None) -> tuple[list[str], list[Row]]:
    # 파일은 한 번만 읽고 메모리에서 인코딩을 판별한다
    text = _decode(path.read_bytes(), encoding)
    reader = csv.reader(io.StringIO(text, newline=""))
    return _to_rows(reader)


def _read_xlsx(path: Path, sheet: str | None) -> tuple[list[str], list[Row]]:
    try:
        import openpyxl
    except ImportError as exc:  # pragma: no cover - 환경 의존
        raise InputError("xlsx 파일을 읽으려면 openpyxl 이 필요합니다: pip install -r requirements.txt") from exc

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        if sheet:
            if sheet not in wb.sheetnames:
                raise InputError(f"시트를 찾을 수 없습니다: {sheet} (존재: {wb.sheetnames})")
            ws = wb[sheet]
        else:
            ws = wb.worksheets[0]
        return _to_rows(ws.iter_rows(values_only=True))
    finally:
        wb.close()


def _is_blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _to_rows(raw_rows) -> tuple[list[str], list[Row]]:
    headers: list[str] | None = None
    rows: list[Row] = []
    for raw in raw_rows:
        if all(_is_blank(v) for v in raw):
            continue
        if headers is None:
            headers = ["" if v is None else str(v).strip() for v in raw]
            continue
        rows.append({h: v for h, v in zip(headers, raw) if h})
    if headers is None:
        raise InputError("명단 파일이 비어 있습니다")
    return headers, rows
