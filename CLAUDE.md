# 교사 수당 계산기 (teacher-pay) — 유지보수 가이드

> 호봉·근무연수 → 정근수당·정근수당 가산금·명절휴가비 즉시 계산.
> 설계: 초판 `docs/superpowers/specs/2026-07-18-teacher-pay-design.md` · **UI 리프레시 `docs/superpowers/specs/2026-07-19-teacher-pay-ui-refresh-design.md`(현행)**.
> **세계관(v2.0~) = 토스/애플식 미니멀.** 무채색 캔버스(--canvas/--surface) + **초록(--brand #17553b)은 액센트로만**(연간 합계·주요 버튼·슬라이더·타임라인 마커·상단 브랜드 점). 금액은 Paperlogy + `tabular-nums`(모노스페이스 은퇴). 시그니처 = 월별 수당 지급 타임라인. **초록을 면(배경·테두리)에 다시 칠하지 말 것.**

## 절대 규칙

1. 바닐라 classic script(전역 공유), 빌드·CDN 없음 — file:// 더블클릭으로 열림. 로드 순서: salary-2026.js → allowance-rules.js → calc.js → app.js.
2. **데이터/로직/표현 분리**: 봉급표=`data/salary-2026.js`, 규정=`data/allowance-rules.js`, 계산=`js/calc.js`(DOM 모름), 렌더=`js/app.js`. 숫자·규정 수정은 data/만.
3. **숫자를 지어내지 말 것.** 봉급표는 인사혁신처 공식표(교차검증). 규정 값 수정 시 공식 법령(공무원수당 등에 관한 규정 별표2) 확인 후 `allowance-rules.js`만 교체하고, `test/verify.mjs`의 예시 기대값도 함께 맞출 것.
4. 수정 후 `node test/verify.mjs`(19건) + `test/probe.html`(26건) 필수.
5. 본문 15px 이상, reduced-motion 존중.
6. **폰트**: Paperlogy(OFL) woff2를 `fonts/`에 셀프호스팅(Bold7·ExtraBold8·Black9). `@font-face`는 상대경로 → file:// 호환. 폴백 스택 `Paperlogy→Pretendard→Malgun`이라 파일 부재 시에도 안 깨짐. 무게 추가 시 `fonts/`에 woff2만 더 넣고 `@font-face` 추가. **본문은 Pretendard 고정**(Paperlogy는 디스플레이·숫자 전용). 라이선스 고지 `fonts/LICENSE-Paperlogy.txt` 유지.
7. **표현층 바인딩 ID 보존**: probe가 `#salaryVal·#jeonggeun·#gasan·#gasanFlag·#holiday·#annual·#rateTag·#hobong(Val)·#years(Val)·.li-note·.hb-cell·#copyBtn·#pngBtn·#timeline·.annual·window.drawSlip`에 의존. HTML 구조를 바꿔도 이 훅은 유지.

## ★ 배포 게이트 (검수 전 배포 금지)

- **봉급표**: 확신도 高 — 인사혁신처 2026 공무원봉급표, 앵커(9호봉 2,495,600 / 40호봉 6,205,700 / 1호봉 2,041,500) 교차검증 완료.
- **명절휴가비 60%**: 확신도 高.
- **정근수당 지급률·가산금·추가가산금**: ✅ 사용자(교사) 공식 법령 확인 완료(2026-07-19). 지급률 [10,10,15,20,20,25,30,35,40,45]→10년이상 50 / 가산금 5년미만 3만·5년 5만·10년 6만·15년 8만·20년 10만 + 추가가산금(20~25년 +1만·25년+ +3만) / 명절 60%.
- `allowance-rules.js`의 `RULES_VERIFIED` = **true(검수 완료, 배포 게이트 열림)**. "검수 예정" 배지 사라짐. 규정 값을 다시 손대면 false로 되돌리고 재검수.

## 검증

`node test/verify.mjs`(봉급표 앵커·단조증가·계산 예시 19건) → `test/probe.html`(호봉 즉시 반영·경계·연합계 + 리프레시 검증 26건, 헤드리스 Edge). ⚠️ 좁은 뷰포트 직접 스크린샷은 이 PC에서 신뢰도 낮음(iframe 프로브로 검증, 데스크톱 스크린샷으로 레이아웃 확인).

**헤드리스 probe 실행법**(중요): probe는 file:// iframe으로 index를 읽으므로 `--allow-file-access-from-files` 플래그가 **필수**(없으면 contentDocument가 opaque-origin으로 null → "Cannot read properties of null" 오탐). 예:
`msedge --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=10000 --dump-dom "file:///.../test/probe.html" | grep -oE '<li>(PASS|FAIL)[^<]*</li>'`
PNG 명세서 시각 확인은 index를 iframe으로 로드 → `contentWindow.document.fonts.ready` 후 `drawSlip().cv.toDataURL()`을 `<img>`에 넣어 스크린샷(state()가 실제 입력 DOM을 읽으므로 index 컨텍스트에서 그려야 함).

## 이력

- v2.0 (2026-07-20, Opus): **UI 리프레시 — greenbar 급여대장 → 토스/애플식 미니멀**(frontend-design). 천공 점선·빨간 직인·초록 밴드·greenbar 줄무늬 제거, 무채색 캔버스+초록 액센트, 동일 높이 카드·하단 중앙 액션 바. **폰트: Paperlogy(디스플레이·숫자, OFL 셀프호스팅)×Pretendard(본문)**, 모노스페이스 은퇴. **시그니처: 월별 수당 지급 타임라인**(정근 1·7월/명절 대표월 2·9월/가산금 매월). PNG 명세서도 새 톤으로 재작성(직인 삭제). **계산·데이터·규정 무변경**. verify 19·probe 26 PASS, 데스크톱·PNG 스크린샷 육안 확인.
- v1.1 (2026-07-19, Opus): **규정 전건 사용자 공식 확인 → RULES_VERIFIED=true(배포 게이트 열림).** 지급률 룩업표 확정, 가산금 5년미만 3만(법개정)·추가가산금 반영. verify 19·probe 13 PASS. **배포 준비 완료** — 레포 생성·푸시만 사용자 몫.
- v1.0 (2026-07-18, Opus): 초판 — 3수당 계산, greenbar 급여대장 UI(frontend-design), verify 17·probe 13 PASS, 데스크톱 스크린샷 확인. 규정 값은 검수 대기(RULES_VERIFIED=false)였음.
