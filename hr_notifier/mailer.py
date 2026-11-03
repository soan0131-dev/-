"""SMTP 발송. 한 번 실행 중에는 연결 1개를 재사용한다."""
from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

from .config import SmtpConfig

log = logging.getLogger(__name__)


class Mailer:
    def __init__(self, cfg: SmtpConfig, dry_run: bool = False):
        self.cfg = cfg
        self.dry_run = dry_run
        self._conn: smtplib.SMTP | None = None

    def __enter__(self) -> "Mailer":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def _connect(self) -> smtplib.SMTP:
        cfg = self.cfg
        context = ssl.create_default_context()
        if cfg.security == "ssl":
            conn: smtplib.SMTP = smtplib.SMTP_SSL(cfg.host, cfg.port, timeout=cfg.timeout, context=context)
        else:
            conn = smtplib.SMTP(cfg.host, cfg.port, timeout=cfg.timeout)
            if cfg.security == "starttls":
                conn.starttls(context=context)
        if cfg.user:
            if cfg.security == "none":
                log.warning("암호화되지 않은 SMTP 연결에서 로그인합니다. security=starttls 또는 ssl 사용을 권장합니다.")
            conn.login(cfg.user, cfg.password or "")
        return conn

    def send(self, msg: EmailMessage) -> None:
        if self.dry_run:
            log.info(
                "[DRY-RUN] 발송 생략: %s → %s\n%s",
                msg["Subject"],
                msg["To"],
                msg.get_body(("plain",)).get_content(),
            )
            return
        # 지연 연결: 보낼 메일이 없으면 SMTP 서버에 접속하지 않는다
        if self._conn is None:
            self._conn = self._connect()
        self._conn.send_message(msg)
        log.info("발송 완료: %s → %s", msg["Subject"], msg["To"])

    def close(self) -> None:
        if self._conn is not None:
            try:
                self._conn.quit()
            except (smtplib.SMTPException, OSError):
                pass
            self._conn = None
