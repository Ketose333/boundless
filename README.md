# NULSIGHT — TCG Workspace

OpenClaw와 분리된 TCG 코어/서버/웹 작업 폴더.

## 목표

- 코어 판정은 독립 실행 (AI/플랫폼 비의존)
- UI는 카드게임 플레이 감성 + 직관 조작
- 서버는 authoritative 판정 단일 소스

## 문서 구조

- 룰 단일본: [`docs/rules.md`](./docs/rules.md)
- 의사결정 기록(상위): [`../policy/engineering_decisions.md`](../policy/engineering_decisions.md)
- 기능 QA 체크리스트(상위): [`../policy/qa_checklist.md`](../policy/qa_checklist.md)
- CSS 아키텍처 책임표(상위): [`../policy/css_architecture.md`](../policy/css_architecture.md)
- 배포 앱 안내(상위): [`../policy/vercel_deploy_app.md`](../policy/vercel_deploy_app.md)
- 코어 안내: [`core/README.md`](./core/README.md)

## 현재 구현 요약 (Alpha 1.0.0)

- 대기실/인게임 페이지 분리 (`lobby.html`, `game.html`)
- 인증/덱/가이드 페이지 운영 (`login.html`, `register.html`, `deck.html`, `guide.html`)
- `index.html`은 인증/상태 기반 라우팅 전용
- 턴 루프/존 배치/스택 해결/자동 페이즈/템포 밸런스 구현
- API는 Vercel Hobby 한도에 맞춰 엔트리 수 최소화

## 용어(프로젝트 공통)

- 플레이어 → 에이전트
- 턴 플레이어 → 액티브 에이전트
- 드로우/메인/배틀/엔드 → Phase 1/2/3/4
- 소환 → 전개(Deploy)
- 연쇄 → Stack

## 운영 메모

- `tcg/*` 변경은 nulsight 기준으로 관리
- KV 상태 리셋은 코드 변경이 아니므로 커밋/푸시 불필요
- UI 변경 시 페이지 역할 분리(대기실/인게임/가이드)를 우선 유지
- 가이드는 규칙/키워드 중심으로 유지하고, 카드 상세(텍스트/메타)는 덱빌딩 화면에서 확인
