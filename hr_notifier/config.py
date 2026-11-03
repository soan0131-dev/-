"""설정 파일(INI) 로딩.

경로/SMTP/수신자 등 환경별 값은 모두 설정 파일에서, SMTP 계정 정보는 환경 변수에서 읽는다.
"""
from __future__ import annotations

import configparser
import os
from dataclasses import dataclass, field
from pathlib import Path

from .reader import normalize_header

ENV_SMTP_USER = "HR_NOTIFIER_SMTP_USER"
ENV_SMTP_PASSWORD = "HR_NOTIFIER_SMTP_PASSWORD"

EVENT_KINDS = ("join", "leave")
EVENT_LABELS = {"join": "입사", "leave": "퇴사"}

# 표마다 필요한 컬럼 (값: 명단 파일의 헤더 이름)
REQUIRED_COLUMNS = ("name", "date")
OPTIONAL_COLUMNS = ("employee_id", "department", "position", "email")

SMTP_SECURITY_MODES = ("starttls", "ssl", "none")

TEAM_SECTION_PREFIX = "team:"


class ConfigError(Exception):
    """설정 파일 내용이 잘못된 경우."""


@dataclass(frozen=True)
class InputConfig:
    path: Path
    encoding: str | None
    sheet: str | None


@dataclass(frozen=True)
class TableConfig:
    """시트 안의 표 하나. 입사자 표 / 퇴사자 표가 열 범위로 나뉘어 있다."""

    kind: str  # "join" | "leave"
    first_col: int  # 0부터 시작하는 열 번호 (A=0)
    last_col: int  # 포함
    columns: dict[str, str]  # 필드명 → 헤더 이름


@dataclass(frozen=True)
class SmtpConfig:
    host: str
    port: int
    security: str
    sender: str
    timeout: float
    user: str | None = field(default=None, repr=False)
    password: str | None = field(default=None, repr=False)


@dataclass(frozen=True)
class Channel:
    """알림 발송 단위 = 담당 부서([team:부서명] 섹션)."""

    name: str
    title: str
    to: tuple[str, ...]
    cc: tuple[str, ...]
    kinds: tuple[str, ...]
    tasks: dict[str, tuple[str, ...]]


@dataclass(frozen=True)
class AppConfig:
    input: InputConfig
    tables: tuple[TableConfig, ...]
    lead_days: int
    past_days: int
    smtp: SmtpConfig
    channels: tuple[Channel, ...]
    state_path: Path
    log_path: Path | None


def _split_addresses(value: str) -> tuple[str, ...]:
    items = [v.strip() for v in value.replace(";", ",").split(",")]
    for addr in items:
        if addr and ("@" not in addr or any(c in addr for c in "\r\n<>\"")):
            raise ConfigError(f"잘못된 이메일 주소: {addr!r}")
    return tuple(a for a in items if a)


def _split_lines(value: str) -> tuple[str, ...]:
    return tuple(line.strip() for line in value.splitlines() if line.strip())


def _split_kinds(value: str, section: str) -> tuple[str, ...]:
    kinds = tuple(k.strip() for k in value.split(",") if k.strip())
    unknown = [k for k in kinds if k not in EVENT_KINDS]
    if unknown:
        raise ConfigError(f"[{section}] kinds 에 알 수 없는 값: {unknown} (허용: {EVENT_KINDS})")
    return kinds


def column_index(letters: str) -> int:
    """엑셀 열 문자 → 0부터 시작하는 번호 (A=0, Z=25, AC=28)."""
    letters = letters.strip().upper()
    if not letters.isascii() or not letters.isalpha():
        raise ValueError(letters)
    index = 0
    for ch in letters:
        index = index * 26 + (ord(ch) - ord("A") + 1)
    return index - 1


def _parse_range(value: str, section: str) -> tuple[int, int]:
    try:
        first, last = (column_index(v) for v in value.split(":"))
    except ValueError as exc:
        raise ConfigError(f"[{section}] range 는 'A:E' 형식이어야 합니다: {value!r}") from exc
    if first > last:
        raise ConfigError(f"[{section}] range 의 시작 열이 끝 열보다 뒤에 있습니다: {value!r}")
    return first, last


def _load_table(cp: configparser.ConfigParser, kind: str) -> TableConfig:
    section = kind
    first, last = _parse_range(_require(cp, section, "range"), section)
    columns = {key: normalize_header(_require(cp, section, key)) for key in REQUIRED_COLUMNS}
    for key in OPTIONAL_COLUMNS:
        header = normalize_header(cp.get(section, key, fallback=""))
        if header:
            columns[key] = header
    return TableConfig(kind=kind, first_col=first, last_col=last, columns=columns)


def _resolve(base: Path, value: str) -> Path:
    p = Path(os.path.expandvars(value)).expanduser()
    return p if p.is_absolute() else (base / p)


def _get_int(cp: configparser.ConfigParser, section: str, key: str, default: int) -> int:
    try:
        value = cp.getint(section, key, fallback=default)
    except ValueError as exc:
        raise ConfigError(f"[{section}] {key} 는 정수여야 합니다") from exc
    if value < 0:
        raise ConfigError(f"[{section}] {key} 는 0 이상이어야 합니다")
    return value


def _require(cp: configparser.ConfigParser, section: str, key: str) -> str:
    value = cp.get(section, key, fallback="").strip()
    if not value:
        raise ConfigError(f"[{section}] {key} 값이 필요합니다")
    return value


def _load_channel(cp: configparser.ConfigParser, section: str) -> Channel:
    to = _split_addresses(cp.get(section, "to", fallback=""))
    if not to:
        raise ConfigError(f"[{section}] to 수신자가 필요합니다")
    title = section[len(TEAM_SECTION_PREFIX):].strip()
    if not title:
        raise ConfigError(f"[{section}] 부서 이름이 비어 있습니다")
    return Channel(
        name=section,
        title=title,
        to=to,
        cc=_split_addresses(cp.get(section, "cc", fallback="")),
        kinds=_split_kinds(cp.get(section, "kinds", fallback=",".join(EVENT_KINDS)), section),
        tasks={kind: _split_lines(cp.get(section, f"{kind}_tasks", fallback="")) for kind in EVENT_KINDS},
    )


def load_config(path: Path) -> AppConfig:
    if not path.is_file():
        raise ConfigError(f"설정 파일을 찾을 수 없습니다: {path}")

    # interpolation 비활성화: 비밀번호/경로에 '%' 가 들어가도 안전하게 처리
    cp = configparser.ConfigParser(interpolation=None)
    data = path.read_bytes()
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("cp949", errors="strict")  # 메모장에서 ANSI 로 저장한 경우
    cp.read_string(text, source=str(path))

    base = path.resolve().parent

    input_cfg = InputConfig(
        path=_resolve(base, _require(cp, "input", "path")),
        encoding=cp.get("input", "encoding", fallback="").strip() or None,
        sheet=cp.get("input", "sheet", fallback="").strip() or None,
    )

    tables = tuple(_load_table(cp, kind) for kind in EVENT_KINDS if cp.has_section(kind))
    if not tables:
        raise ConfigError("[join](입사자 표) 또는 [leave](퇴사자 표) 섹션이 최소 1개 필요합니다")

    security = cp.get("smtp", "security", fallback="starttls").strip().lower()
    if security not in SMTP_SECURITY_MODES:
        raise ConfigError(f"[smtp] security 는 {SMTP_SECURITY_MODES} 중 하나여야 합니다")
    sender = _require(cp, "smtp", "sender")
    _split_addresses(sender)  # 형식 검증
    smtp = SmtpConfig(
        host=_require(cp, "smtp", "host"),
        port=_get_int(cp, "smtp", "port", 587),
        security=security,
        sender=sender,
        timeout=float(_get_int(cp, "smtp", "timeout", 30)),
        user=os.environ.get(ENV_SMTP_USER) or None,
        password=os.environ.get(ENV_SMTP_PASSWORD) or None,
    )

    channel_sections = [s for s in cp.sections() if s.startswith(TEAM_SECTION_PREFIX)]
    if not channel_sections:
        raise ConfigError("[team:부서명] 섹션이 최소 1개 필요합니다")
    channels = tuple(_load_channel(cp, s) for s in channel_sections)

    log_value = cp.get("log", "path", fallback="").strip()

    return AppConfig(
        input=input_cfg,
        tables=tables,
        lead_days=_get_int(cp, "schedule", "lead_days", 7),
        past_days=_get_int(cp, "schedule", "past_days", 3),
        smtp=smtp,
        channels=channels,
        state_path=_resolve(base, cp.get("state", "path", fallback="state/sent.json")),
        log_path=_resolve(base, log_value) if log_value else None,
    )
