"""입퇴사자 명단 파일(CSV / XLSX) 읽기."""
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


Row = dict[str, Any]


def normalize_header(value: Any) -> str:
    """셀 안 줄바꿈/공백 차이('입사 일자', '입사\\n일자')를 무시하고 헤더를 비교하기 위한 정규화."""
    return "" if value is None else "".join(str(value).split())


def read_table(
    path: Path,
    headers: Iterable[str],
    encoding: str | None = None,
    sheet: str | None = None,
) -> list[Row]:
    """파일을 읽어 행 목록을 반환한다. 각 행은 {헤더: 값} 딕셔너리.

    headers 에 지정한 컬럼이 모두 들어 있는 첫 행을 헤더 행으로 보고, 그 위의 행(제목 등)은 무시한다.
    """
    if not path.is_file():
        raise InputError(f"명단 파일을 찾을 수 없습니다: {path}")
    wanted = {normalize_header(h) for h in headers}
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return _read_csv(path, wanted, encoding)
    if suffix in (".xlsx", ".xlsm"):
        return _read_xlsx(path, wanted, sheet)
    raise InputError(f"지원하지 않는 파일 형식입니다: {suffix or '(확장자 없음)'} (.csv, .xlsx, .xlsm 만 지원)")


def _decode(data: bytes, encoding: str | None) -> str:
    candidates = (encoding,) if encoding else DEFAULT_CSV_ENCODINGS
    for enc in candidates:
        try:
            return data.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    raise InputError(f"CSV 인코딩을 해석할 수 없습니다 (시도: {', '.join(candidates)})")


def _read_csv(path: Path, wanted: set[str], encoding: str | None) -> list[Row]:
    # 파일은 한 번만 읽고 메모리에서 인코딩을 판별한다
    text = _decode(path.read_bytes(), encoding)
    return _to_rows(csv.reader(io.StringIO(text, newline="")), wanted)


def _read_xlsx(path: Path, wanted: set[str], sheet: str | None) -> list[Row]:
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
        return _to_rows(ws.iter_rows(values_only=True), wanted)
    finally:
        wb.close()


def _is_blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _to_rows(raw_rows: Iterable[Iterable[Any]], wanted: set[str]) -> list[Row]:
    headers: list[str] | None = None
    best: tuple[int, list[str]] = (-1, [])  # 오류 메시지용: 가장 많이 일치한 행
    rows: list[Row] = []
    for index, raw in enumerate(raw_rows):
        raw = tuple(raw)
        if headers is None:
            if index >= HEADER_SCAN_ROWS:
                break
            candidate = [normalize_header(v) for v in raw]
            matched = len(wanted.intersection(candidate))
            if matched == len(wanted):
                headers = candidate
            elif matched > best[0]:
                best = (matched, candidate)
            continue
        if all(_is_blank(v) for v in raw):
            continue
        rows.append({h: v for h, v in zip(headers, raw) if h})

    if headers is None:
        found = [h for h in best[1] if h]
        missing = sorted(wanted.difference(best[1]))
        raise InputError(
            f"상위 {HEADER_SCAN_ROWS}행에서 헤더 행을 찾지 못했습니다. "
            f"설정의 [columns] 를 실제 헤더에 맞춰 주세요. 없는 컬럼: {missing} / 가장 비슷한 행: {found}"
        )
    return rows
