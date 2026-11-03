"""입퇴사자 명단 파일(CSV / XLSX) 읽기.

한 시트에 입사자 표와 퇴사자 표가 열 범위로 나란히 있는 형식을 지원한다.
파일은 한 번만 읽고(read_sheet), 표마다 열 범위를 잘라 쓴다(extract_table).
"""
from __future__ import annotations

import csv
import io
from pathlib import Path
from typing import Any, Iterable

# 인코딩 미지정 시 시도 순서: Excel "CSV UTF-8" → 한글 Windows 기본(CP949)
DEFAULT_CSV_ENCODINGS = ("utf-8-sig", "cp949")

# 제목 행·작성일 등 머리말이 있는 파일을 위해 헤더 행을 찾을 최대 행 수
HEADER_SCAN_ROWS = 30


class InputError(Exception):
    """명단 파일을 읽을 수 없는 경우."""


RawRow = tuple[Any, ...]
Row = dict[str, Any]


def normalize_header(value: Any) -> str:
    """셀 안 줄바꿈/공백 차이('입사 일자', '입사\\n일자')를 무시하고 헤더를 비교하기 위한 정규화."""
    return "" if value is None else "".join(str(value).split())


def read_sheet(path: Path, encoding: str | None = None, sheet: str | None = None) -> list[RawRow]:
    """시트 전체를 셀 값 튜플 목록으로 읽는다."""
    if not path.is_file():
        raise InputError(f"명단 파일을 찾을 수 없습니다: {path}")
    suffix = path.suffix.lower()
    if suffix == ".csv":
        text = _decode(path.read_bytes(), encoding)
        return [tuple(r) for r in csv.reader(io.StringIO(text, newline=""))]
    if suffix in (".xlsx", ".xlsm"):
        return _read_xlsx(path, sheet)
    raise InputError(f"지원하지 않는 파일 형식입니다: {suffix or '(확장자 없음)'} (.csv, .xlsx, .xlsm 만 지원)")


def _decode(data: bytes, encoding: str | None) -> str:
    candidates = (encoding,) if encoding else DEFAULT_CSV_ENCODINGS
    for enc in candidates:
        try:
            return data.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    raise InputError(f"CSV 인코딩을 해석할 수 없습니다 (시도: {', '.join(candidates)})")


def _read_xlsx(path: Path, sheet: str | None) -> list[RawRow]:
    try:
        import openpyxl
    except ImportError as exc:  # pragma: no cover - 환경 의존
        raise InputError("xlsx 파일을 읽으려면 openpyxl 이 필요합니다: pip install -r requirements.txt") from exc

    try:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    except PermissionError as exc:
        raise InputError(f"명단 파일을 열 수 없습니다 (OneDrive 동기화 중이거나 권한 없음): {path}") from exc
    try:
        if sheet:
            if sheet not in wb.sheetnames:
                raise InputError(f"시트를 찾을 수 없습니다: {sheet} (존재: {wb.sheetnames})")
            ws = wb[sheet]
        else:
            ws = wb.worksheets[0]
        return [tuple(r) for r in ws.iter_rows(values_only=True)]
    finally:
        wb.close()


def _is_blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def extract_table(
    raw_rows: list[RawRow],
    first_col: int,
    last_col: int,
    headers: Iterable[str],
    label: str = "",
) -> list[tuple[int, Row]]:
    """열 범위 [first_col, last_col] 안의 표를 읽어 (엑셀 행 번호, {헤더: 값}) 목록을 반환한다.

    범위 안에서 headers 가 모두 들어 있는 첫 행을 헤더 행으로 보고, 그 위(제목 등)는 무시한다.
    범위 안이 모두 빈 행은 건너뛴다 (입사자/퇴사자 표의 길이가 달라도 됨).
    """
    wanted = {normalize_header(h) for h in headers}
    width = last_col - first_col + 1
    header_row: list[str] | None = None
    best: tuple[int, list[str]] = (-1, [])  # 오류 메시지용: 가장 많이 일치한 행
    rows: list[tuple[int, Row]] = []

    for row_no, raw in enumerate(raw_rows, start=1):
        cells = raw[first_col:last_col + 1]
        if header_row is None:
            if row_no > HEADER_SCAN_ROWS:
                break
            candidate = [normalize_header(v) for v in cells]
            matched = len(wanted.intersection(candidate))
            if matched == len(wanted):
                header_row = candidate
            elif matched > best[0]:
                best = (matched, candidate)
            continue
        if all(_is_blank(v) for v in cells):
            continue
        cells = cells + (None,) * (width - len(cells))  # 짧은 CSV 행 보정
        rows.append((row_no, {h: v for h, v in zip(header_row, cells) if h}))

    if header_row is None:
        found = [h for h in best[1] if h]
        missing = sorted(wanted.difference(best[1]))
        raise InputError(
            f"{label} 표의 헤더 행을 상위 {HEADER_SCAN_ROWS}행에서 찾지 못했습니다. "
            f"설정의 열 범위와 헤더 이름을 확인해 주세요. 없는 컬럼: {missing} / 가장 비슷한 행: {found}"
        )
    return rows
