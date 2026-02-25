# Git History Archive

- reset 시점: 2026-02-20 13:44:04 KST
- reset 직전 HEAD: 3a04fb296746c712ecd1109fbb96249e5832be67
- 목적: 이니셜커밋 기준으로 이력 단순화

## reset 직전 최근 이력 20개
- 2026-02-20 | 3a04fb2 | fix(match-flow): reset room game on win and unify button styles via shared accent tokens
- 2026-02-20 | d00f945 | fix(game-ui): restore core gameplay flow while keeping mobile HUD redesign
- 2026-02-20 | e96e624 | refactor(game-ui): disable zone highlights and compact board density; refresh legacy docs
- 2026-02-20 | 6d76d03 | fix(flow): prevent lobby-game redirect loop after match end
- 2026-02-20 | eafb912 | feat(game-ui): compact top status, remove preview panel, and tune board tilt/highlight rules
- 2026-02-20 | e313c03 | chore(game-ui): remove stale mid/meta styles and clean top-status remnants
- 2026-02-20 | 1eb50fa | refactor(game-ui): unify top status section and harden mobile responsive layout
- 2026-02-20 | 620999f | feat(game): add grave zone, card-like board rendering, and lobby auto-enter
- 2026-02-20 | 0e7a84f | fix(game-ui): auto-exit on game end and separate notices from status
- 2026-02-20 | 245869f | fix(rooms): expose public room state and add inactive-room cleanup
- 2026-02-20 | 0d09e4f | refactor(game-ui): normalize hand wrapper and remove unused deck styles
- 2026-02-20 | fe9ff0f | chore(copy): refine polite Korean UI text for responsiveness
- 2026-02-20 | 3e8f035 | chore(release): normalize legacy docs/text and set project to BOUNDLESS PROTOCOL Alpha 1.0.0
- 2026-02-20 | 3a2cba1 | Initial commit

- reset 시점: 2026-02-21 (KST)
- reset 직전 HEAD(nulsight): 0bde84b
- 목적: 배경 연속성 수정 및 CSS 책임 분리 반영 후 이니셜커밋 재평탄화

## 기억 포인트(최근 주요 변경)
- 2026-02-21 | 0bde84b | fix(ui): smooth continuous background gradient without band seams
- 2026-02-21 | 3acaf3d | fix(deck-ui): restore split layout for pool and current deck
- 2026-02-21 | e76b239 | fix(ui): soften background gradient/grid intensity
- 2026-02-21 | f8c7a8c | fix(css): restore grid background and deck visual card styles
- 2026-02-21 | 0cec1ab | fix(css): restore loading overlay and deck pool grid styles

- reset 시점: 2026-02-22 (KST)
- reset 직전 HEAD(nulsight): 0e116dd
- 목적: 120초 미응답 처리/표시명 로그/선공 1턴 배틀 스킵 반영 후 이력 재평탄화

## 기억 포인트(최근 주요 변경, 2026-02-22)
- 2026-02-22 | 0e116dd | fix(rooms): finalize timeout-ended match on state to prevent re-entry loop
- 2026-02-22 | 1622337 | fix(match): skip first-turn battle and handle 120s inactive forfeit
- 2026-02-22 | d9cc13d | fix(game): restore 120s inactive cleanup and switch logs to display names
- 2026-02-22 | 4d205ee | feat(game): split deck/grave zones and add right grave drawer
- 2026-02-22 | f3ec202 | feat(game): compact desktop battle layout and show remaining deck count
- 2026-02-22 | 272fdc7 | Initial commit

- reset 시점: 2026-02-22 (KST)
- reset 직전 HEAD(nulsight): f201043
- 목적: 모바일 스크롤/툴바 순서/반응형 일관성 조정 반영 후 이니셜커밋 재평탄화

## 기억 포인트(최근 주요 변경, 2026-02-22 야간)
- 2026-02-22 | f201043 | fix(game-ui): improve mobile hand scroll and reorder toolbar with concede left / phase right
- 2026-02-22 | 5857dd2 | refactor(game-ui): move toolbar between zones and remove stale signature/chip styles
- 2026-02-22 | ba83616 | fix(game-ui): prevent small-screen zone overlap with dedicated 421-560 responsive constraints
- 2026-02-22 | f1d3c07 | fix(game-ui): remove top/bottom labels and align deck/grave as slot-sized right rail without clipping
- 2026-02-22 | f62f07e | fix(game-ui): unify desktop section widths and tighten overall board footprint
- 2026-02-22 | 50ec902 | fix(game-ui): prevent right-side clipping by reducing large-screen zone cell scale and set compact desktop board width

- reset 시점: 2026-02-22 (KST)
- reset 직전 HEAD(nulsight): dbbeccb
- 목적: 모바일 손패 드래그 스크롤 개선 및 툴바 좌/우 순서 고정 반영 후 이니셜커밋 재평탄화

## 기억 포인트(최근 주요 변경, 2026-02-22 심야)
- 2026-02-22 | dbbeccb | fix(game-ui): improve mobile hand drag-scroll interaction
- 2026-02-22 | b842238 | Initial commit

- reset 시점: 2026-02-22 (KST)
- reset 직전 HEAD(nulsight): 2fdabe0
- 목적: B안(손패 겹침형 무스크롤) 및 툴바 좌우 고정 순서 반영 후 이니셜커밋 재평탄화

## 기억 포인트(최근 주요 변경, 2026-02-22 새벽)
- 2026-02-22 | 2fdabe0 | feat(game-ui): apply dynamic overlapped hand layout without horizontal scroll
- 2026-02-22 | b1ce512 | Initial commit

- reset 시점: 2026-02-22 (KST)
- reset 직전 HEAD(nulsight): 1ce9bee
- 목적: 가이드 섹션(1/4/6) 제거 및 번호 재정렬 반영 후 이니셜커밋 재평탄화

## 기억 포인트(최근 주요 변경, 2026-02-22)
- 2026-02-22 | 1ce9bee | refactor(palette): unify green into mint and apply mint accent consistently across game styles
- 2026-02-22 | 5d1ec42 | tune(guide-ui): soften asymmetry by restoring balanced single-column desktop flow
- 2026-02-22 | 8a94370 | refactor(guide-ui): redesign guide aesthetics with asymmetric layout and sticky TOC (no mode-chip/signature)
- 2026-02-22 | 9330bf4 | refactor(guide): align styles to global tokens and keep guide free of mode-chip/signature patterns
- 2026-02-22 | 13472e0 | refactor(css): unify shared chip/signature patterns in global styles and remove duplicated page-specific implementations
- 2026-02-22 | 0cc7a07 | refactor(ui): remove guide badges, enlarge guide body text via global tokens, and make grave/card overlays fully opaque
- 2026-02-22 | a8806e2 | chore(copy): keep keyword descriptions in declarative ~다 style and document tone rule
- 2026-02-22 | 5c48f48 | chore(copy): unify user-facing html/js Korean tone to consistent 해요체
- 2026-02-22 | 24ea5c9 | fix(ui-mobile): disable drag/selection by default and allow selection for room code only
- 2026-02-22 | 1f29cce | fix(game-input): separate action tap and info long-press for field/grave cards
- 2026-02-22 | 636b519 | fix(game-overlay): use shared keyword dictionary and contextual fallback descriptions
- 2026-02-22 | e59c911 | feat(game-ui): add master-duel style card inspect overlay with field/grave click and hand long-press
