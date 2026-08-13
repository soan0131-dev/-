# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Status

This repository is currently empty — there are no commits on any branch, locally or on the remote (`origin` at `soan0131-dev/-`). There is no existing codebase, build system, test suite, or architecture to document yet. Once code is added, this file should be updated to reflect actual build/lint/test commands and the real architecture — do not invent commands or structure that don't exist.

## Development Guidelines

These rules apply to all work in this repository, regardless of what gets built here:

- **BAT 파일 인코딩**: `.bat` 파일을 생성할 때는 한글(또는 비ASCII 문자) 인코딩에 주의한다. Windows 배치 파일은 기본적으로 시스템 로케일 코드페이지(예: CP949/EUC-KR)를 사용하므로, 파일을 UTF-8로 저장할 경우 스크립트 첫 줄에 `chcp 65001`을 추가하거나, 처음부터 ANSI/CP949로 저장하는 등 실행 환경과 인코딩을 맞춰야 한다. 인코딩 불일치로 한글이 깨지거나 스크립트가 오작동하지 않도록 항상 확인한다.
- **효율적인 코드**: 불필요한 반복 연산, 중복 파일 I/O, 과도한 프로세스 생성 등을 피하고 항상 효율적인 방식으로 코드를 작성한다.
- **하드코딩 금지**: 경로, URL, 자격 증명, 포트 번호, 환경별 값 등을 코드에 직접 박아넣지 않는다. 설정 파일, 환경 변수, 인자 등을 통해 값을 주입한다.
- **보안 고려**: 커맨드/스크립트 인젝션, 자격 증명 노출, 안전하지 않은 권한 설정 등을 항상 염두에 두고 코드를 작성한다. 특히 배치/셸 스크립트에서 사용자 입력을 그대로 명령어에 삽입하지 않는다.
