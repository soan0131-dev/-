import smtplib
import tempfile
import textwrap
import unittest
from datetime import date, datetime
from pathlib import Path

from hr_notifier.app import run
from hr_notifier.config import ConfigError, column_index, load_config
from hr_notifier.reader import InputError, extract_table, read_sheet
from hr_notifier.records import merge_events, parse_date, parse_events
from hr_notifier.state import SentState

ROOT = Path(__file__).resolve().parent.parent
SAMPLE = ROOT / "samples" / "sample_roster.csv"

# 실제 명단 형식: 입사자(성명, 입사날짜, 본부) / 퇴사자(성명, 퇴사날짜, 본부)
JOIN_COLUMNS = {"name": "성명", "date": "입사날짜", "department": "본부"}
LEAVE_COLUMNS = {"name": "성명", "date": "퇴사날짜", "department": "본부"}
# 선택 컬럼(사번 등)까지 있는 형식
FULL_COLUMNS = {"employee_id": "사번", "name": "성명", "department": "부서", "position": "직급", "date": "입사일"}
A_E = (0, 4)
Z_AC = (25, 28)

CONFIG_TEXT = textwrap.dedent(
    f"""
    [input]
    path = {SAMPLE.as_posix()}
    [join]
    range = A:E
    name = 성명
    date = 입사날짜
    department = 본부
    [leave]
    range = Z:AC
    name = 성명
    date = 퇴사날짜
    department = 본부
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


def side_by_side_rows(join_rows, leave_rows, title=True):
    """A:E 입사자 표, Z:AC 퇴사자 표가 나란히 있는 시트 행 생성."""
    rows = [("2026년 입퇴사자 현황",), ()] if title else []

    def pad(left):
        return tuple(left) + (None,) * (25 - len(left))  # A~Y

    rows.append(pad(JOIN_COLUMNS.values()) + tuple(LEAVE_COLUMNS.values()))
    for i in range(max(len(join_rows), len(leave_rows))):
        left = join_rows[i] if i < len(join_rows) else ()
        right = tuple(leave_rows[i]) if i < len(leave_rows) else ()
        rows.append(pad(left) + right)
    return rows


class RecordsTest(unittest.TestCase):
    def test_parse_date_formats(self):
        for value in ("2026-11-05", "2026.11.05", "2026/11/05", "20261105", "2026.11.05.", "2026-11-05 00:00:00"):
            self.assertEqual(parse_date(value), date(2026, 11, 5), value)
        self.assertEqual(parse_date(datetime(2026, 11, 5, 9)), date(2026, 11, 5))
        with self.assertRaises(ValueError):
            parse_date("11월 5일")

    def test_parse_events_errors_and_dedupe(self):
        rows = [
            (2, {"사번": 12345.0, "성명": "홍길동", "부서": "재무팀", "입사일": "2026-11-05"}),
            (3, {"사번": "12345", "성명": "홍길동", "부서": "재무팀", "입사일": "2026.11.05"}),
            (4, {"사번": "2", "성명": "", "부서": "재무팀", "입사일": "2026-11-05"}),
            (5, {"사번": "4", "성명": "이", "부서": "재무팀", "입사일": "모름"}),
        ]
        events, errors = parse_events(rows, FULL_COLUMNS, "join")
        self.assertEqual(len(merge_events(events)), 1)
        self.assertEqual(events[0].employee_id, "12345")
        self.assertEqual(len(errors), 2)
        self.assertTrue(errors[0].startswith("4행"))

    def test_key_without_employee_id(self):
        events, _ = parse_events([(2, {"성명": "김철수", "본부": "감사본부", "퇴사날짜": "2026-11-07"})], LEAVE_COLUMNS, "leave")
        self.assertEqual(events[0].key, "leave|감사본부/김철수|2026-11-07")

    def test_newlines_are_stripped(self):
        rows = [(2, {"성명": "홍\r\n길동", "본부": "감사본부", "입사날짜": "2026-11-05"})]
        events, _ = parse_events(rows, JOIN_COLUMNS, "join")
        self.assertEqual(events[0].name, "홍 길동")


class ReaderTest(unittest.TestCase):
    def test_column_index(self):
        self.assertEqual([column_index(c) for c in ("A", "E", "Z", "AC", "ac")], [0, 4, 25, 28, 28])

    def test_side_by_side_tables_with_different_lengths(self):
        raw = side_by_side_rows(
            [("홍길동", "2026-11-05", "감사본부"), ("이영희", "2026-11-06", "세무본부")],
            [("김철수", "2026-11-07", "세무본부")],
        )
        joins = extract_table(raw, *A_E, JOIN_COLUMNS.values())
        leaves = extract_table(raw, *Z_AC, LEAVE_COLUMNS.values())
        self.assertEqual([r["성명"] for _, r in joins], ["홍길동", "이영희"])
        self.assertEqual([(n, r["성명"]) for n, r in leaves], [(4, "김철수")])  # 엑셀 행 번호 유지

    def test_csv_encodings_and_short_rows(self):
        with tempfile.TemporaryDirectory() as d:
            for enc in ("utf-8-sig", "cp949"):
                path = Path(d) / f"{enc}.csv"
                path.write_bytes(SAMPLE.read_text(encoding="utf-8-sig").encode(enc))
                raw = read_sheet(path)
                self.assertEqual(len(extract_table(raw, *A_E, JOIN_COLUMNS.values())), 3)
                self.assertEqual(len(extract_table(raw, *Z_AC, LEAVE_COLUMNS.values())), 2)

    def test_xlsx_with_title_rows_and_wrapped_header(self):
        import openpyxl

        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "roster.xlsx"
            wb = openpyxl.Workbook()
            ws = wb.active
            for row in side_by_side_rows(
                [("홍길동", datetime(2026, 11, 5), "감사본부")],
                [("김철수", datetime(2026, 11, 7), "세무본부")],
            ):
                ws.append(row)
            ws["B3"] = "입사\n날짜"  # 셀 안 줄바꿈 헤더
            wb.save(path)
            raw = read_sheet(path)
            events, errors = parse_events(extract_table(raw, *A_E, JOIN_COLUMNS.values()), JOIN_COLUMNS, "join")
            self.assertEqual(errors, [])
            self.assertEqual((events[0].name, events[0].date, events[0].department), ("홍길동", date(2026, 11, 5), "감사본부"))

    def test_missing_header_reports_columns(self):
        raw = side_by_side_rows([], [])
        with self.assertRaises(InputError) as ctx:
            extract_table(raw, *Z_AC, ["성명", "퇴사예정일"], "퇴사")
        self.assertIn("퇴사예정일", str(ctx.exception))


class AppTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
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
        self.assertIn("입사 2명, 퇴사 1명", subjects[0])
        self.assertIn("(퇴사 1명)", subjects[1])
        body = FakeMailer.sent[0].get_body(("plain",)).get_content()
        self.assertIn("계정 생성", body)
        self.assertIn("김철수", body)
        self.assertIn("감사본부", body)
        html = FakeMailer.sent[0].get_body(("html",)).get_content()
        self.assertIn("<th>소속</th>", html)
        self.assertNotIn("<th>사번</th>", html)  # 값이 없는 항목은 표시하지 않음
        self.assertNotIn("최지우", body)  # 기간 밖 (12/01)
        self.assertNotIn("박민수", body)  # 기간 밖 (12/31)

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
        roster = self.dir / "roster.csv"
        roster.write_text("성명,입사날짜,본부\n<script>,2026-11-05,감사본부\n", encoding="utf-8")
        (self.dir / "config.ini").write_text(
            CONFIG_TEXT.replace(SAMPLE.as_posix(), "roster.csv").split("[leave]")[0]
            + CONFIG_TEXT.split("department = 본부", 2)[2],
            encoding="utf-8",
        )
        run(load_config(self.dir / "config.ini"), date(2026, 11, 3), mailer_factory=FakeMailer)
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
    def _load(self, text):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "config.ini"
            path.write_text(text, encoding="utf-8")
            return load_config(path)

    def test_invalid_values(self):
        cases = [
            ("to = it@example.com", "to = it@example.com\nkinds = hire"),
            ("to = it@example.com", "to = not-an-email"),
            ("range = A:E", "range = E:A"),
            ("range = Z:AC", "range = Z-AC"),
            ("date = 입사날짜", ""),
        ]
        for old, new in cases:
            with self.assertRaises(ConfigError, msg=new):
                self._load(CONFIG_TEXT.replace(old, new))

    def test_requires_team_and_table_sections(self):
        with self.assertRaises(ConfigError):
            self._load(CONFIG_TEXT.split("[team:IT]")[0])
        no_tables = CONFIG_TEXT.split("[join]")[0] + "[schedule]" + CONFIG_TEXT.split("[schedule]")[1]
        with self.assertRaises(ConfigError):
            self._load(no_tables)

    def test_cp949_config_loads(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "config.ini"
            path.write_bytes(CONFIG_TEXT.encode("cp949"))
            self.assertEqual(load_config(path).tables[0].columns["date"], "입사날짜")

    def test_example_config_loads(self):
        cfg = load_config(ROOT / "config.example.ini")
        self.assertEqual([c.name for c in cfg.channels], ["team:IT", "team:총무", "team:보안"])
        self.assertEqual([(t.kind, t.first_col, t.last_col) for t in cfg.tables], [("join", 0, 4), ("leave", 25, 28)])


if __name__ == "__main__":
    unittest.main()
