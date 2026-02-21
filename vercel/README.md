# BOUNDLESS PROTOCOL — vercel Deploy App

Vercel 배포 대상 앱(API + UI).

## 프로젝트 설정

- Framework Preset: `Other`
- Root Directory: `vercel`
- Build Command: 비움
- Output Directory: 비움

> boundless 레포 기준 루트는 `vercel`.

## 환경변수

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

KV 연결 시 룸/덱/인증 세션 상태가 인스턴스 변경에도 유지된다.

## 룰/결정 문서

- 룰 단일본: [`../docs/rules.md`](../docs/rules.md)
- 결정 기록: [`../docs/tcg_decisions.md`](../docs/tcg_decisions.md)

## API 구조 (Hobby 함수 수 최적화)

현재 API 엔트리는 5개 파일로 고정:

- `/api/health`
- `/api/auth` (`action=register|login|me|logout`)
- `/api/rooms` (`action=create|join|state|reset|clear|clear_inactive|clear_all`)
  - `clear_all`: `confirm=CONFIRM_ALL_ROOMS` 전달 시 전체 룸 삭제
- `/api/game` (`action=action`)
- `/api/deck` (`GET` 조회, `POST` 저장)

원칙:

- 새 기능은 가능한 기존 엔트리의 `action` 분기로 추가
- 함수 파일 수를 불필요하게 늘리지 않음

## 인증/권한

- 인증 세션 쿠키(`bp_session`) 기반
- 클라이언트가 `actorId`를 지정하지 않고 서버가 세션 기준으로 주입
- 룸 `reset`은 owner만 가능
- 룸 `clear`는 내(owner) 룸만 삭제

## UI 라우팅

- `/index.html`: 라우팅 전용
- `/login.html`: 로그인
- `/register.html`: 회원가입
- `/lobby.html`: 대기실
- `/game.html`: 인게임
- `/deck.html`: 덱빌딩
- `/guide.html`: 가이드

## public 파일 역할

- `public/styles.css`: 공용 스타일(공통 버튼 토큰/클래스 포함)
- `public/js/login.js`: 인증 화면 로직
- `public/js/lobby.js`: 대기실 로직(최근 roomId/agentId sessionStorage 복구 포함)
- `public/js/game.js`: 인게임 로직(최근 roomId/agentId URL 보정 + 복구 포함)
- `public/js/deck.js`: 덱 조회/편집/저장
- `public/js/shared-cards.js`: 카드 정의/메타(종족·테마·속성)/효과 DSL/텍스트 자동생성 단일 소스

## 주의

- KV 미연결 시 메모리 저장이라 서버 교체 시 상태 유실 가능
