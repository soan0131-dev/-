"""발송 이력 저장 (중복 발송 방지)."""
from __future__ import annotations

import json
import os
import tempfile
from datetime import date, datetime
from pathlib import Path


class SentState:
    """채널별 발송 완료 이벤트 키를 JSON 파일에 기록한다.

    형식: {"채널명": {"이벤트키": "발송시각"}}
    """

    def __init__(self, path: Path):
        self.path = path
        self._data: dict[str, dict[str, str]] = {}
        self._dirty = False
        if path.is_file():
            with path.open(encoding="utf-8") as f:
                loaded = json.load(f)
            if isinstance(loaded, dict):
                self._data = {k: dict(v) for k, v in loaded.items() if isinstance(v, dict)}

    def is_sent(self, channel: str, key: str) -> bool:
        return key in self._data.get(channel, {})

    def mark(self, channel: str, keys: list[str]) -> None:
        now = datetime.now().isoformat(timespec="seconds")
        bucket = self._data.setdefault(channel, {})
        for key in keys:
            bucket[key] = now
        self._dirty = True

    def prune(self, before: date) -> None:
        """이벤트 일자가 before 이전인 기록 삭제 (알림 대상 기간 밖이므로 재발송되지 않음)."""
        cutoff = before.isoformat()
        for bucket in self._data.values():
            stale = [k for k in bucket if k.rsplit("|", 1)[-1] < cutoff]
            for k in stale:
                del bucket[k]
            self._dirty = self._dirty or bool(stale)

    def save(self) -> None:
        if not self._dirty:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        # 임시 파일에 쓴 뒤 교체: 저장 중 중단되어도 기존 이력이 깨지지 않음
        fd, tmp = tempfile.mkstemp(dir=self.path.parent, prefix=".sent-", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(self._data, f, ensure_ascii=False, indent=2, sort_keys=True)
            os.replace(tmp, self.path)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise
        self._dirty = False
