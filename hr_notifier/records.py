"""명단 행 → 입퇴사 이벤트 변환."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Iterable

from .config import REQUIRED_COLUMNS

DATE_FORMATS = ("%Y-%m-%d", "%Y.%m.%d", "%Y/%m/%d", "%Y%m%d")


@dataclass(frozen=True)
class Event:
    employee_id: str
    name: str
    department: str
    position: str
    kind: str  # "join" | "leave"
    date: date
    email: str

    @property
    def key(self) -> str:
        """중복 발송 방지용 고유 키. 사번이 없으면 부서+성명으로 식별한다. (마지막 '|' 뒤는 항상 일자)"""
        ident = self.employee_id or f"{self.department}/{self.name}"
        return f"{self.kind}|{ident}|{self.date.isoformat()}"


def to_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)  # 엑셀 숫자 사번 12345.0 → "12345"
    # 개행 제거: 메일 제목/본문 형식이 깨지지 않도록
    return " ".join(str(value).split())


def parse_date(value: Any) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = to_text(value).split(" ")[0].rstrip(".")
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"날짜 형식을 인식할 수 없습니다: {value!r}")


def parse_events(
    rows: Iterable[tuple[int, dict[str, Any]]],
    columns: dict[str, str],
    kind: str,
) -> tuple[list[Event], list[str]]:
    """(행 번호, 행) 목록을 kind(입사/퇴사) 이벤트로 변환한다. (이벤트 목록, 오류 메시지 목록) 반환."""
    events: list[Event] = []
    errors: list[str] = []

    for row_no, row in rows:
        values = {field: to_text(row.get(header)) for field, header in columns.items()}
        missing = [columns[f] for f in REQUIRED_COLUMNS if not values.get(f)]
        if missing:
            errors.append(f"{row_no}행: 필수 값 누락 {missing}")
            continue
        try:
            event_date = parse_date(row.get(columns["date"]))
        except ValueError as exc:
            errors.append(f"{row_no}행: {exc}")
            continue
        events.append(
            Event(
                employee_id=values.get("employee_id", ""),
                name=values["name"],
                department=values.get("department", ""),
                position=values.get("position", ""),
                kind=kind,
                date=event_date,
                email=values.get("email", ""),
            )
        )
    return events, errors


def merge_events(events: Iterable[Event]) -> list[Event]:
    """중복 키 제거 후 일자·구분·부서·성명 순으로 정렬."""
    unique: dict[str, Event] = {}
    for e in events:
        unique.setdefault(e.key, e)
    return sorted(unique.values(), key=lambda e: (e.date, e.kind, e.department, e.name))
