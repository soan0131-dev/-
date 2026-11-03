import smtplib
import tempfile
import textwrap
import unittest
from datetime import date, datetime
from pathlib import Path

from hr_notifier.app import run
from hr_notifier.config import ConfigError, load_config
from hr_notifier.reader import read_table
from hr_notifier.records import parse_date, parse_events
from hr_notifier.state import SentState

COLUMNS = {
    "employee_id": "사번",
    "name": "성명",
    "department": "부서",
    "position": "직급",
    "event_type": "구분",
    "date": "일자",
    "email": "이메일",
}
EVENT_VALUES = {"입사": "join", "퇴사": "leave"}

CSV_TEXT = (
    "사번,성명,부서,직급,구분,일자,이메일\n"
    "1,홍길동,재무팀,사원,입사,2026-11-05,a@example.com\n"
    "2,김철수,감사본부,매니저,퇴사,2026-11-07,b@example.com\n"
    "3,이영희,세무본부,,입사,2026-12-31,\n"
)

CONFIG_TEXT = textwrap.dedent(
    """
    [input]
    path = roster.csv
    [columns]
    employee_id = 사번
    name = 성명
    department = 부서
    position = 직급
    event_type = 구분
    date = 일자
    email = 이메일
    [schedule]
    lead_days = 7
    past_days = 3
    [smtp]
    host = localhost
    sender = noti@example.com
    [team:IT]
    to = it@example.com
    join_tasks =
        계정 생성
    [team:보안]
    to = sec@example.com
    kinds = leave
    [state]
    path = state/sent.json
    """
)


class FakeMailer:
    sent: list = []
    fail_subjects: tuple = ()

    def __init__(self, cfg, dry_run):
        self.dry_run = dry_run

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        pass

    def send(self, msg):
        if any(s in msg["Subject"] for s in self.fail_subjects):
            raise smtplib.SMTPException("boom")
        if not self.dry_run:
            FakeMailer.sent.append(msg)


class RecordsTest(unittest.TestCase):
    def test_parse_date_formats(self):
        for value in ("2026-11-05", "2026.11.05", "2026/11/05", "20261105", "2026.11.05.", "2026-11-05 00:00:00"):
            self.assertEqual(parse_date(value), date(2026, 11, 5), value)
        self.assertEqual(parse_date(datetime(2026, 11, 5, 9)), date(2026, 11, 5))
        with self.assertRaises(ValueError):
            parse_date("11월 5일")

    def test_parse_events_errors_and_dedupe(self):
        rows = [
            {"사번": 12345.0, "성명": "홍길동", "부서": "재무팀", "구분": "입사", "일자": "2026-11-05"},
            {"사번": "12345", "성명": "홍길동", "부서": "재무팀", "구분": "입사", "일자": "2026.11.05"},
            {"사번": "2", "성명": "", "부서": "재무팀", "구분": "입사", "일자": "2026-11-05"},
            {"사번": "3", "성명": "김", "부서": "재무팀", "구분": "휴직", "일자": "2026-11-05"},
            {"사번": "4", "성명": "이", "부서": "재무팀", "구분": "퇴사", "일자": "모름"},
        ]
        events, errors = parse_events(rows, COLUMNS, EVENT_VALUES)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].employee_id, "12345")
        self.assertEqual(len(errors), 3)

    def test_newlines_are_stripped(self):
        rows = [{"사번": "1", "성명": "홍\r\n길동", "부서": "재무팀", "구분": "입사", "일자": "2026-11-05"}]
        events, _ = parse_events(rows, COLUMNS, EVENT_VALUES)
        self.assertEqual(events[0].name, "홍 길동")


class ReaderTest(unittest.TestCase):
    def test_csv_encodings(self):
        with tempfile.TemporaryDirectory() as d:
            for enc in ("utf-8-sig", "cp949"):
                path = Path(d) / f"{enc}.csv"
                path.write_bytes(CSV_TEXT.encode(enc))
                headers, rows = read_table(path)
                self.assertEqual(headers[0], "사번")
                self.assertEqual(rows[0]["성명"], "홍길동")
                self.assertEqual(len(rows), 3)

    def test_xlsx(self):
        import openpyxl

        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "roster.xlsx"
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.append(list(COLUMNS.values()))
            ws.append([1001, "홍길동", "재무팀", "사원", "입사", datetime(2026, 11, 5), None])
            wb.save(path)
            headers, rows = read_table(path)
            events, errors = parse_events(rows, COLUMNS, EVENT_VALUES)
            self.assertEqual(errors, [])
            self.assertEqual(events[0].employee_id, "1001")
            self.assertEqual(events[0].date, date(2026, 11, 5))


class AppTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        (self.dir / "roster.csv").write_text(CSV_TEXT, encoding="utf-8-sig")
        (self.dir / "config.ini").write_text(CONFIG_TEXT, encoding="utf-8")
        self.cfg = load_config(self.dir / "config.ini")
        FakeMailer.sent = []
        FakeMailer.fail_subjects = ()

    def tearDown(self):
        self.tmp.cleanup()

    def test_sends_once_per_channel_and_dedupes(self):
        today = date(2026, 11, 3)
        self.assertEqual(run(self.cfg, today, mailer_factory=FakeMailer), 0)
        subjects = [m["Subject"] for m in FakeMailer.sent]
        self.assertEqual(len(subjects), 2)  # IT, 보안
        self.assertIn("입사 1명, 퇴사 1명", subjects[0])
        self.assertIn("퇴사 1명", subjects[1])
        self.assertNotIn("입사", subjects[1].split("(")[-1])
        body = FakeMailer.sent[0].get_body(("plain",)).get_content()
        self.assertIn("계정 생성", body)
        self.assertNotIn("이영희", body)  # 기간 밖

        FakeMailer.sent = []
        self.assertEqual(run(self.cfg, today, mailer_factory=FakeMailer), 0)
        self.assertEqual(FakeMailer.sent, [])

    def test_dry_run_does_not_write_state(self):
        run(self.cfg, date(2026, 11, 3), dry_run=True, mailer_factory=FakeMailer)
        self.assertFalse(self.cfg.state_path.exists())

    def test_failed_channel_is_retried(self):
        FakeMailer.fail_subjects = ("[인사/IT]",)
        self.assertEqual(run(self.cfg, date(2026, 11, 3), mailer_factory=FakeMailer), 1)
        self.assertEqual([m["To"] for m in FakeMailer.sent], ["sec@example.com"])

        FakeMailer.sent, FakeMailer.fail_subjects = [], ()
        self.assertEqual(run(self.cfg, date(2026, 11, 3), mailer_factory=FakeMailer), 0)
        self.assertEqual([m["To"] for m in FakeMailer.sent], ["it@example.com"])

    def test_html_is_escaped(self):
        (self.dir / "roster.csv").write_text(
            "사번,성명,부서,직급,구분,일자,이메일\n1,<script>,재무팀,,입사,2026-11-05,\n", encoding="utf-8"
        )
        run(self.cfg, date(2026, 11, 3), mailer_factory=FakeMailer)
        html = FakeMailer.sent[0].get_body(("html",)).get_content()
        self.assertNotIn("<script>", html)
        self.assertIn("&lt;script&gt;", html)

    def test_state_prune(self):
        state = SentState(self.dir / "s.json")
        state.mark("team:IT", ["join|1|2026-01-01", "join|2|2026-11-05"])
        state.prune(before=date(2026, 10, 31))
        self.assertFalse(state.is_sent("team:IT", "join|1|2026-01-01"))
        self.assertTrue(state.is_sent("team:IT", "join|2|2026-11-05"))


class ConfigTest(unittest.TestCase):
    def test_requires_team_section(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "config.ini"
            path.write_text(CONFIG_TEXT.split("[team:IT]")[0], encoding="utf-8")
            with self.assertRaises(ConfigError):
                load_config(path)

    def test_invalid_values(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "config.ini"
            for bad in ("to = it@example.com\nkinds = hire", "to = not-an-email", "to ="):
                path.write_text(CONFIG_TEXT.replace("to = it@example.com", bad), encoding="utf-8")
                with self.assertRaises(ConfigError, msg=bad):
                    load_config(path)

    def test_example_config_loads(self):
        cfg = load_config(Path(__file__).resolve().parent.parent / "config.example.ini")
        self.assertEqual([c.name for c in cfg.channels], ["team:IT", "team:총무", "team:보안"])
        self.assertEqual(cfg.event_values["신규입사"], "join")


if __name__ == "__main__":
    unittest.main()
