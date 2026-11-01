# 교사 수당 계산기 (teacher-pay) — 유지보수 가이드

> 호봉·근무연수 → 정근수당·정근수당 가산금·명절휴가비 즉시 계산.
> 설계: 초판 `docs/superpowers/specs/2026-07-18-teacher-pay-design.md` · **UI 리프레시 `docs/superpowers/specs/2026-07-19-teacher-pay-ui-refresh-design.md`(현행)**.
> **세계관(v2.0~) = 토스/애플식 미니멀.** 무채색 캔버스(--canvas/--surface) + **초록(--brand #013e37)은 액센트로만**(주요 버튼·슬라이더·타임라인 마커·상단 브랜드 점·강조 글자). 금액은 Paperlogy + `tabular-nums`(모노스페이스 은퇴). 시그니처 = 월별 수당 지급 타임라인. **초록을 면(배경·테두리)에 다시 칠하지 말 것.**
> **v2.3~ 강조 면은 버터(웜 옐로)**: `--butter #ffefb3`(연간 합계 블록·활성 행) / `--butter-soft #fff8dd`(hover·요율 배지) / `--butter-deep #f7d97a`(타임라인 지급월 세그먼트). 구 `--brand-tint #eef4f0`·`#cfe3d6`은 **폐기 — 초록 tint를 되살리지 말 것.**

## 절대 규칙

1. 바닐라 classic script(전역 공유), 빌드·CDN 없음 — file:// 더블클릭으로 열림. 로드 순서: salary-2026.js → allowance-rules.js → calc.js → app.js.
2. **데이터/로직/표현 분리**: 봉급표=`data/salary-2026.js`, 규정=`data/allowance-rules.js`, 계산=`js/calc.js`(DOM 모름), 렌더=`js/app.js`. 숫자·규정 수정은 data/만.
3. **숫자를 지어내지 말 것.** 봉급표는 인사혁신처 공식표(교차검증). 규정 값 수정 시 공식 법령(공무원수당 등에 관한 규정 별표2) 확인 후 `allowance-rules.js`만 교체하고, `test/verify.mjs`의 예시 기대값도 함께 맞출 것.
4. 수정 후 `node test/verify.mjs`(44건) + `test/probe.html`(87건) + `node test/browser.mjs`(46건, Edge 실브라우저) 필수.
5. 본문 15px 이상, reduced-motion 존중.
6. **폰트**: Paperlogy(OFL) woff2를 `fonts/`에 셀프호스팅(Bold7·ExtraBold8·Black9). `@font-face`는 상대경로 → file:// 호환. 폴백 스택 `Paperlogy→Pretendard→Malgun`이라 파일 부재 시에도 안 깨짐. 무게 추가 시 `fonts/`에 woff2만 더 넣고 `@font-face` 추가. **본문은 Pretendard 고정**(Paperlogy는 디스플레이·숫자 전용). 라이선스 고지 `fonts/LICENSE-Paperlogy.txt` 유지.
7. **표현층 바인딩 ID 보존**: probe가 `#salaryVal·#jeonggeun·#gasan·#gasanFlag·#holiday·#annual·#rateTag·#hobong(Val)·#years(Val)·.li-note·.hb-cell·#copyBtn·#pngBtn·#timeline·.annual·window.drawSlip`에 의존. v2.4부터 `#resultCard·#annualBox·#stickyTotal·#stickyAmt·#stickyMore·#resetBtn·#lgPromo·#actMsg`와 전역 `summaryText()`·`drawSlip().texts`도 테스트 훅. HTML 구조를 바꿔도 이 훅은 유지.

## ★ 배포 게이트 (검수 전 배포 금지)

- **봉급표**: 확신도 高 — 인사혁신처 2026 공무원봉급표, 앵커(9호봉 2,495,600 / 40호봉 6,205,700 / 1호봉 2,041,500) 교차검증 완료.
- **명절휴가비 60%**: 확신도 高.
- **정근수당 지급률·가산금·추가가산금**: ✅ 사용자(교사) 공식 법령 확인 완료(2026-07-19), **지급률은 2026-11-02 별표2 <개정 2025.1.3> 원문(law.go.kr 별표 PDF)과 재대조해 2년 15%→20% 정정**. 지급률 = `JG_RATE_TIERS` 구간표 하나(계산·모달 공용): 0·1년 10 / 2~4년 20 / 5년 25 / 6년 30 / 7년 35 / 8년 40 / 9년 45 / 10년이상 50 / 가산금 5년미만 3만·5년 5만·10년 6만·15년 8만·20년 10만 + 추가가산금(20~25년 +1만·25년+ +3만) / 명절 60%.
- `allowance-rules.js`의 `RULES_VERIFIED` = **true(검수 완료, 배포 게이트 열림)**. "검수 예정" 배지 사라짐. 규정 값을 다시 손대면 false로 되돌리고 재검수.

## 기능 스위치 (v2.4~)

`js/app.js` 맨 위 `const FLAGS = { stickyTotal: true, persistState: true };`
- `stickyTotal`: 768px 이하 하단 고정 합계 바(+body 하단 여백). false면 바·여백이 사라진다(호봉표 클릭 안내 문구는 플래그와 무관하게 유지).
- `persistState`: URL 쿼리 `?y=근무연수&h=호봉&m=승급월(0=없음)` · localStorage `teacherPay.v1` · 초기화 버튼 · 복사 텍스트 끝 링크. 시작값 = 쿼리 > 저장값 > 기본(10·20·3월), 항목별 검증. 저장은 사용자가 바꿀 때만(공유 링크로 연 값은 저장 안 함).
- 둘 다 false면 v2.3(B1 반영) 화면과 같음 — `BASELINE_DIR`로 이전 버전을 주면 browser.mjs가 결과·복사·배치를 비교한다.
- 화면·결과 복사·이미지 저장은 `render()`가 만든 `current` 한 객체를 읽는다. 지급분별 호봉 기준 문구는 `basisNote()` 하나로 셋이 공유.

## 검증

`node test/verify.mjs`(봉급표 앵커·지급률·계산 예시·기준 문구 44건) → `test/probe.html`(file:// iframe, 87건) → `node test/browser.mjs`(Playwright+Edge, 로컬 http 서버로 URL 쿼리·저장·새로고침·390/1280 고정 바·FLAGS 끔 46건). browser.mjs는 `PLAYWRIGHT_MODULE=D:/Works/token_economy/node_modules/playwright/index.js`처럼 playwright 경로를 주고 실행(브라우저 1개만 띄우고 닫음). ⚠️ 좁은 뷰포트 직접 스크린샷은 이 PC에서 신뢰도 낮음(iframe 프로브로 검증, 데스크톱 스크린샷으로 레이아웃 확인).

**헤드리스 probe 실행법**(중요): probe는 file:// iframe으로 index를 읽으므로 `--allow-file-access-from-files` 플래그가 **필수**(없으면 contentDocument가 opaque-origin으로 null → "Cannot read properties of null" 오탐). 예:
`msedge --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=10000 --dump-dom "file:///.../test/probe.html" | grep -oE '<li>(PASS|FAIL)[^<]*</li>'`
PNG 명세서 시각 확인은 index를 iframe으로 로드 → `contentWindow.document.fonts.ready` 후 `drawSlip().cv.toDataURL()`을 `<img>`에 넣어 스크린샷(state()가 실제 입력 DOM을 읽으므로 index 컨텍스트에서 그려야 함).

## 이력

- v2.4 (2026-11-02, Opus): **사용성 통합 개선(지시서 Phase A·B·C)**. A: 정근수당 지급률을 별표2 <개정 2025.1.3> 원문과 대조해 **2년 15%→20%** 정정, `JG_RATE_TIERS` 구간표 하나로 계산·모달 공용, 모달 출처 "(2025.1.3 개정 반영)". B1: 승급월과 상관없이 정근·명절 항상 지급분별 2줄+호봉, 기준 문구("1·7월 모두 20호봉 기준"/"11월 승급 전이라 …19호봉으로 계산"/"승급 반영 · …"), 복사·이미지 동일, 달력 범례 "▲ 호봉 승급월". B2: 쿼리·저장·초기화·복사 링크(FLAGS.persistState). C1: 모바일 하단 고정 합계 바(IntersectionObserver로 합계 박스 보이면 숨김, reduced-motion 존중, safe-area 여백, FLAGS.stickyTotal) + 호봉표 클릭 시 "20호봉 → 25호봉으로 바꿨어요". verify 44·probe 87·browser 46 PASS, FLAGS 끔 = 이전 버전과 결과·배치 동일 확인.
- v2.2 (2026-07-20, Opus): **호봉 승급월 반영(도메인 정확도)**. 교사 호봉은 승급월에 +1 → 같은 해에도 승급 전 지급분(1월 정근·설 명절)은 옛 호봉, 후(7월 정근·추석 명절)는 오른 호봉. `calc.js`에 순수 함수 `hobongAtMonth(m,호봉,승급월,오늘월)`·`computeYear(...)` 추가(가산금은 호봉 무관이라 불변). **날짜는 클라이언트 `new Date()`, 테스트 주입 시임 `window.__todayMonth`**(app.js `todayMonth()`), 승급월 셀렉트 기본 3월(없음 옵션). 승급 시 정근/명절 행은 지급월·호봉 태그로 분할 표시, 연간 합계 계산식 상세화, 타임라인에 지급월별 호봉·승급월(▲) 표기. verify 31·probe 42 PASS. **모바일**: 320/360/390px iframe 프로브로 무오버플로 확인(좁은 뷰포트 직접 스크린샷은 여전히 비신뢰 — 프로브로 scrollWidth 측정). ⚠️ 승급월 반영은 계산·데이터·규정 무변경(표현·조합 로직만).
- v2.1 (2026-07-20, Opus): **연차별 지급표 모달 + @jungbucks 서명 스탬프**(08fcd1b, 푸시됨). 정근수당/가산금 행을 `<dialog>`로 열어 연차별 지급률(%)·월 정액표(현재 근무연수 하이라이트) 표시 — 검증된 `jeonggeunRate`·`gasangeum` 재사용, 표시 전용. 연간 합계 밑 절제된 초록 서명 스탬프(화면·PNG 공통, 지난 빨간 직인과 다름). ESC·백드롭·× 닫기. probe 34 PASS. **헤드리스 PNG 확인법 보강**: img/dataURL 타이밍이 불안정 → `document.adoptNode(iframe.drawSlip().cv)`로 상위 문서에 붙여 스크린샷하는 게 안정적.
- v2.0 (2026-07-20, Opus): **UI 리프레시 — greenbar 급여대장 → 토스/애플식 미니멀**(frontend-design). 천공 점선·빨간 직인·초록 밴드·greenbar 줄무늬 제거, 무채색 캔버스+초록 액센트, 동일 높이 카드·하단 중앙 액션 바. **폰트: Paperlogy(디스플레이·숫자, OFL 셀프호스팅)×Pretendard(본문)**, 모노스페이스 은퇴. **시그니처: 월별 수당 지급 타임라인**(정근 1·7월/명절 대표월 2·9월/가산금 매월). PNG 명세서도 새 톤으로 재작성(직인 삭제). **계산·데이터·규정 무변경**. verify 19·probe 26 PASS, 데스크톱·PNG 스크린샷 육안 확인.
- v1.1 (2026-07-19, Opus): **규정 전건 사용자 공식 확인 → RULES_VERIFIED=true(배포 게이트 열림).** 지급률 룩업표 확정, 가산금 5년미만 3만(법개정)·추가가산금 반영. verify 19·probe 13 PASS. **배포 준비 완료** — 레포 생성·푸시만 사용자 몫.
- v1.0 (2026-07-18, Opus): 초판 — 3수당 계산, greenbar 급여대장 UI(frontend-design), verify 17·probe 13 PASS, 데스크톱 스크린샷 확인. 규정 값은 검수 대기(RULES_VERIFIED=false)였음.
