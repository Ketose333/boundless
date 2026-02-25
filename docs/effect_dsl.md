# effect_dsl.md — 카드 효과 DSL 초안 v0.1

목적: 카드 효과를 텍스트/코드에서 동일하게 표현하고, 룰 확장 시 파편화를 막는다.

## 1) 기본 구조

```json
{
  "id": "direct_hit",
  "type": "spell|monster",
  "cost": 1,
  "effects": [
    {
      "timing": "on_play",
      "condition": { "phase": "main" },
      "action": { "kind": "deal_damage_to_agent", "target": "opponent", "value": 2 }
    }
  ]
}
```

- `timing`: 언제 발동하는지
- `condition`: 발동 조건
- `action`: 실제 처리
- `type`의 `monster`는 **내부 키**이며, UI/문서 표기는 **유닛**으로 통일한다.

---

## 2) timing 집합 (v0.1)

- `on_play` : 카드 전개/사용 시
- `on_deploy` : 유닛 전개 시
- `on_attack_declared` : 공격 선언 시
- `on_attack_hit` : 공격 적중 시
- `on_turn_start` : 내 턴 시작
- `on_turn_end` : 내 턴 종료
- `active` : 에이전트가 직접 기동

---

## 3) condition 집합 (v0.1)

- `phase`: `main|battle|end`
- `my_turn`: `true|false`
- `has_mana_gte`: 숫자
- `target_exists`: `enemy_unit|ally_unit|enemy_agent|self`
- `per_turn_limit`: 숫자 (기본 1)

예시:
```json
{ "phase": "main", "my_turn": true, "per_turn_limit": 1 }
```

---

## 4) action 집합 (v0.1)

- `deal_damage_to_agent` : 에이전트에게 피해
- `deal_damage_to_unit` : 유닛에게 피해
- `heal_unit` : 유닛 회복
- `draw` : 드로우
- `gain_mana` : 마나 증가
- `search_deck_to_hand` : 덱에서 탐색 후 손패
- `deploy_from_deck` : 덱에서 유닛 전개
- `apply_status` : 상태 부여(버프/디버프)

예시:
```json
{ "kind": "search_deck_to_hand", "filter": { "type": "spell" }, "count": 1 }
```

---

## 5) target 표준

- `self`
- `opponent`
- `self_unit`
- `opponent_unit`
- `selected_unit`

---

## 6) 기동비용 표준

비용은 `cost.mana`로 명시:

```json
{
  "timing": "active",
  "cost": { "mana": 2 },
  "condition": { "phase": "main", "my_turn": true },
  "action": { "kind": "draw", "value": 1 }
}
```

- 비용 미지불 시 `action`은 실행하지 않음
- 로그는 `effect skipped (not enough mana)` 형식 유지

---

## 7) 처리 순서 (authoritative)

1. timing 만족 여부 확인
2. condition 검증
3. cost 지불
4. action 실행
5. per-turn usage 기록
6. 로그 기록

---

## 8) 기존 코드와 매핑 계획

- `shared-cards.js` 카드 정의에 `effects[]` 필드 추가
- `lib/game.js`는 DSL 인터프리터 기반으로 확장
- 현재 카드 효과는 `effects[]` 기준으로 동작

---

## 9) v0.1 범위 밖(후속)

- 체인 반응형 트리거 다중 등록
- 지속효과 레이어 우선순위
- replacement effect
- 무효화/카운터 룰

---

## 10) 빠른 적용 가이드

- 신규 카드 추가 시 하드코딩 분기부터 늘리지 말고 `effects[]` 먼저 작성
- 구현이 없는 `kind`는 빌드 시 경고 출력
- UI 텍스트는 DSL 원문이 아니라 해석된 한국어 라벨 사용
