/* [데이터·교체 지점] 수당 규정 값 — 여기 값만 바꾸면 계산 전체가 반영됨. 규칙을 바꾸면 test/verify.mjs 예시도 함께 맞출 것.
   ─ 근거 ─
   · 정근수당 지급률: 사용자(교사) 공식 법령 확인(2026-07-19). 근무연수 N년(정수)별 %:
       0·1년 10 / 2년 15 / 3·4년 20 / 5년 25 / 6년 30 / 7년 35 / 8년 40 / 9년 45 / 10년이상 50. (규칙적이지 않아 룩업표)
   · 정근수당 가산금: 사용자 공식 확인(2026-07-19, 법 개정 반영). 5년미만 3만 / 5년~ 5만 / 10년~ 6만 / 15년~ 8만 / 20년~ 10만.
     ※ "5년 미만 미지급"은 개정 전 옛 표. 현행은 5년 미만도 3만원.
     ※ 추가가산금(20년이상 위에 +금액)은 사용자 확인 대기 — 확인되면 gasangeum에 반영.
   · 명절휴가비: 월봉급액의 60%(설·추석 각각). */

/* 정근수당 지급률(%) — 근무연수(정수)로 조회. index=근무연수(0~9), 10년이상 50. */
function jeonggeunRate(years) {
  if (years >= 10) return 50;
  const RATE = [10, 10, 15, 20, 20, 25, 30, 35, 40, 45]; // 0년 … 9년
  return RATE[Math.max(0, years)];
}

/* 정근수당 가산금(원/월) — 근무연수 구간별 정액. */
function gasangeum(years) {
  if (years < 5) return 30000;
  if (years < 10) return 50000;
  if (years < 15) return 60000;
  if (years < 20) return 80000;
  return 100000;
}

/* 명절휴가비율 — 월봉급액 대비. 설·추석 각각 지급. */
const HOLIDAY_RATE = 0.60;

/* 이 규정 값이 사용자 공식 검수를 통과했는지 표시(배포 게이트). 검수 완료 시 true로. */
const RULES_VERIFIED = false;

if (typeof module !== 'undefined') module.exports = { jeonggeunRate, gasangeum, HOLIDAY_RATE, RULES_VERIFIED };
