# CSS 아키텍처 책임표 (Alpha 1.0.0)

TCG 프론트 CSS의 중복/충돌 방지를 위한 단일 기준 문서.

## 원칙

- 공용은 `styles.css`에만 둔다.
- 페이지 전용 UI는 각 페이지 CSS에서만 정의한다.
- 색상 토큰은 `palette.css` 단일 소스만 사용한다.
- 같은 셀렉터를 여러 파일에 중복 정의하지 않는다(예외: `:root` 토큰 계층).

## 파일별 책임

- [`vercel/public/palette.css`](../vercel/public/palette.css)
  - 색상/글로우/버튼 컬러 토큰
  - 의미 토큰(`--c-*`)의 최종 소스

- [`vercel/public/styles.css`](../vercel/public/styles.css)
  - 전역 기초 스타일(타이포, 유틸, panel/input/button 기본형)
  - 접근성 유틸(`.sr-only`) 및 공용 유틸 클래스(`.mt8`, `.w100`, `.muted` 등)
  - **페이지별 레이아웃/보드/핸드/덱 상세 스타일 금지**

- [`vercel/public/header-footer.css`](../vercel/public/header-footer.css)
  - 상단/하단 레이아웃 및 브랜드 바 컴포넌트만 담당

- [`vercel/public/lobby.css`](../vercel/public/lobby.css)
  - 대기실 전용 레이아웃/패널/상태 카드

- [`vercel/public/deck.css`](../vercel/public/deck.css)
  - 덱빌딩 전용 레이아웃/카드 풀/덱 리스트

- [`vercel/public/guide.css`](../vercel/public/guide.css)
  - 가이드 전용 카드/TOC/KPI

- [`vercel/public/game.css`](../vercel/public/game.css)
  - 인게임 HUD/보드/손패/오버레이

- [`vercel/public/login.css`](../vercel/public/login.css)
  - 로그인/회원가입 공용 인증 화면 스타일

## 금지 규칙

- 페이지 CSS에서 색상 hex 하드코딩 금지(토큰 사용 필수).
- `styles.css`에 특정 페이지 id/class(예: `#hand`, `.lobby-*`, `.deck-*`, `.guide-*`, `.game-*`) 신규 추가 금지.
- 동일한 공용 클래스(`.muted`, `.sr-only` 등)를 페이지 CSS에서 재정의 금지.

## 변경 체크리스트

1. 새 스타일이 공용인지 페이지 전용인지 먼저 분류.
2. 색상은 `palette.css` 토큰으로만 표현.
3. 공용 클래스 중복 정의 여부 확인.
4. `vercel build` 통과 확인.

## 메모

- 현재 구조는 "공용 코어(`styles.css`) + 페이지 분리"가 기본값.
- 스타일 충돌이 발생하면 우선 `styles.css`로 끌어올리지 말고, 페이지 CSS 경계를 먼저 점검한다.
