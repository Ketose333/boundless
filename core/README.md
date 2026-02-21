# BOUNDLESS PROTOCOL — core Rule Engine

TCG 판정 코어 계층.

## 원칙

- UI/서버/AI 어댑터와 분리
- 순수 상태(state) + 액션(action) 전이
- 서버 authoritative 판정 소스

## 현재 범위 (v0)

- 에이전트 기준 상태 (`agents`, `activeAgentId`, `firstAgentId`)
- 초기 상태/덱/핸드 구성
- 턴 진행(드로우 자동 처리 포함)
- 페이즈 전이 (`main`, `battle`, `end`)
- 기본 액션
  - `play_card`
  - `attack`
  - `end_phase`
  - `resolve_stack`
  - `concede`
- 존 규칙
  - 몬스터 존 3
  - 마법 존 4
- 스택 최소 구현(LIFO)

## 룰 참조

- 룰 단일본: [`../docs/rules.md`](../docs/rules.md)
- 의사결정 기록: [`../docs/tcg_decisions.md`](../docs/tcg_decisions.md)

## 다음 작업

- 카드 텍스트 기반 효과 해석 확장
- Trigger/Interrupt 타이밍 강화
- 원본 룰셋 정합성 1:1 반영
