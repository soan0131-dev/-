"""알림 메일 본문 생성."""
from __future__ import annotations

from datetime import date
from email.message import EmailMessage
from html import escape

from .config import EVENT_KINDS, EVENT_LABELS, Channel
from .records import Event

WEEKDAYS = "월화수목금토일"


def _fmt_date(d: date) -> str:
    return f"{d.isoformat()}({WEEKDAYS[d.weekday()]})"


def _group(events: list[Event]) -> dict[str, list[Event]]:
    return {kind: [e for e in events if e.kind == kind] for kind in EVENT_KINDS}


def _person(e: Event) -> str:
    position = f" {e.position}" if e.position else ""
    return f"{e.department} {e.name}{position}"


def _announce_body(groups: dict[str, list[Event]]) -> tuple[str, str]:
    text: list[str] = ["안녕하세요, 인사 안내드립니다.", ""]
    html: list[str] = ["<p>안녕하세요, 인사 안내드립니다.</p>"]
    for kind, events in groups.items():
        if not events:
            continue
        label = EVENT_LABELS[kind]
        text.append(f"■ {label}")
        html.append(f"<h3>{label}</h3><ul>")
        for e in events:
            text.append(f"  - {_fmt_date(e.date)} {_person(e)}")
            html.append(f"<li>{escape(_fmt_date(e.date))} {escape(_person(e))}</li>")
        text.append("")
        html.append("</ul>")
    closing = "새로 오신 분들은 따뜻하게 맞이해 주시고, 떠나시는 분들의 앞날을 응원해 주세요."
    text.append(closing)
    html.append(f"<p>{closing}</p>")
    return "\n".join(text), "\n".join(html)


def _task_body(channel: Channel, groups: dict[str, list[Event]]) -> tuple[str, str]:
    text: list[str] = [f"{channel.title} 담당자님, 아래 입퇴사자 관련 업무 처리를 요청드립니다.", ""]
    html: list[str] = [f"<p>{escape(channel.title)} 담당자님, 아래 입퇴사자 관련 업무 처리를 요청드립니다.</p>"]
    for kind, events in groups.items():
        if not events:
            continue
        label = EVENT_LABELS[kind]
        tasks = channel.tasks.get(kind, ())
        text.append(f"■ {label}자 ({len(events)}명)")
        html.append(
            f"<h3>{label}자 ({len(events)}명)</h3>"
            '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse">'
            "<tr><th>일자</th><th>사번</th><th>부서</th><th>성명</th><th>직급</th><th>이메일</th></tr>"
        )
        for e in events:
            text.append(
                f"  - {_fmt_date(e.date)} | {e.employee_id} | {e.department} | {e.name} | {e.position} | {e.email}"
            )
            cells = (_fmt_date(e.date), e.employee_id, e.department, e.name, e.position, e.email)
            html.append("<tr>" + "".join(f"<td>{escape(c)}</td>" for c in cells) + "</tr>")
        html.append("</table>")
        if tasks:
            text.append("  [처리 항목]")
            text.extend(f"   □ {t}" for t in tasks)
            html.append("<p><b>처리 항목</b></p><ul>" + "".join(f"<li>{escape(t)}</li>" for t in tasks) + "</ul>")
        text.append("")
    return "\n".join(text), "\n".join(html)


def build_message(channel: Channel, events: list[Event], sender: str, today: date) -> EmailMessage:
    groups = _group(events)
    counts = ", ".join(f"{EVENT_LABELS[k]} {len(v)}명" for k, v in groups.items() if v)
    if channel.is_announce:
        subject = f"[인사] 입퇴사자 안내 ({counts})"
        text, html = _announce_body(groups)
    else:
        subject = f"[인사/{channel.title}] 입퇴사자 업무 처리 요청 ({counts})"
        text, html = _task_body(channel, groups)

    footer = f"\n\n※ 본 메일은 입퇴사자 알림 시스템에서 자동 발송되었습니다. ({today.isoformat()})"
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = ", ".join(channel.to)
    if channel.cc:
        msg["Cc"] = ", ".join(channel.cc)
    msg.set_content(text + footer)
    msg.add_alternative(
        '<html><body style="font-family:\'Malgun Gothic\',sans-serif">'
        f"{html}<p style=\"color:#888;font-size:small\">{escape(footer.strip())}</p></body></html>",
        subtype="html",
    )
    return msg
