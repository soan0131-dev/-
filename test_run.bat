@echo off
rem ------------------------------------------------------------------
rem Test run. Double-click this file.
rem Shows who would be notified and the mail text. NO mail is sent.
rem ------------------------------------------------------------------
call "%~dp0run_notifier.bat" --dry-run
echo.
pause
