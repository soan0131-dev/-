"""실행 흐름: 명단 읽기 → 알림 대상 선별 → 채널별 메일 발송 → 이력 저장."""
from __future__ import annotations

import logging
import smtplib
from datetime import date, timedelta
from typing import Callable

from .config import AppConfig, SmtpConfig
from .mailer import Mailer
from .reader import read_table
from .records import check_headers, parse_events
from .state import SentState
from .templates import build_message

log = logging.getLogger(__name__)

MailerFactory = Callable[[SmtpConfig, bool], Mailer]


def run(cfg: AppConfig, today: date, dry_run: bool = False, mailer_factory: MailerFactory = Mailer) -> int:
    """실행 후 종료 코드 반환 (0: 정상, 1: 일부/전체 실패)."""
    headers, rows = read_table(cfg.input.path, cfg.input.encoding, cfg.input.sheet)

    missing = check_headers(headers, cfg.columns)
    if missing:
        log.error("명단 파일에 필요한 컬럼이 없습니다: %s (파일 헤더: %s)", missing, headers)
        return 1

    events, errors = parse_events(rows, cfg.columns, cfg.event_values)
    for err in errors:
        log.warning("건너뜀 - %s", err)

    start = today - timedelta(days=cfg.past_days)
    end = today + timedelta(days=cfg.lead_days)
    targets = [e for e in events if start <= e.date <= end]
    log.info("명단 %d건 중 알림 기간(%s ~ %s) 대상 %d건", len(events), start, end, len(targets))

    state = SentState(cfg.state_path)
    state.prune(before=start)
    failures = 0
    try:
        with mailer_factory(cfg.smtp, dry_run) as mailer:
            for channel in cfg.channels:
                pending = [
                    e for e in targets if e.kind in channel.kinds and not state.is_sent(channel.name, e.key)
                ]
                if not pending:
                    log.info("[%s] 신규 발송 대상 없음", channel.name)
                    continue
                msg = build_message(channel, pending, cfg.smtp.sender, today)
                try:
                    mailer.send(msg)
                except (smtplib.SMTPException, OSError) as exc:
                    failures += 1
                    log.error("[%s] 발송 실패 (다음 실행 시 재시도): %s", channel.name, exc)
                    continue
                if not dry_run:
                    state.mark(channel.name, [e.key for e in pending])
    finally:
        if not dry_run:
            state.save()

    return 1 if failures else 0
