"""명령행 진입점: python -m hr_notifier --config config.ini [--dry-run] [--today YYYY-MM-DD]"""
from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import date
from pathlib import Path

from .app import run
from .config import ConfigError, load_config
from .reader import InputError

ENV_CONFIG = "HR_NOTIFIER_CONFIG"


def _setup_logging(log_path: Path | None) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler()]
    if log_path is not None:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_path, encoding="utf-8"))
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=handlers,
        force=True,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="hr_notifier", description="입퇴사자 메일 알림")
    parser.add_argument(
        "--config",
        type=Path,
        default=os.environ.get(ENV_CONFIG),
        help=f"설정 파일 경로 (기본: 환경 변수 {ENV_CONFIG})",
    )
    parser.add_argument("--dry-run", action="store_true", help="메일을 보내지 않고 대상만 확인")
    parser.add_argument("--today", type=date.fromisoformat, default=None, help="기준 일자 (테스트용, YYYY-MM-DD)")
    args = parser.parse_args(argv)

    if args.config is None:
        parser.error(f"--config 또는 환경 변수 {ENV_CONFIG} 로 설정 파일을 지정하세요")

    try:
        cfg = load_config(Path(args.config))
    except ConfigError as exc:
        logging.basicConfig(level=logging.INFO)
        logging.error("설정 오류: %s", exc)
        return 2

    _setup_logging(cfg.log_path)
    try:
        return run(cfg, args.today or date.today(), dry_run=args.dry_run)
    except InputError as exc:
        logging.error("명단 파일 오류: %s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
